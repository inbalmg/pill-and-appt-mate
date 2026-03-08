import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Web Push helper functions using Web Crypto API
async function sendWebPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: string, vapidKeys: { publicKey: string; privateKey: string }) {
  const vapidPrivateKeyJwk = JSON.parse(vapidKeys.privateKey);
  
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    vapidPrivateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const jwtHeader = btoa(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const audience = new URL(subscription.endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = btoa(JSON.stringify({
    aud: audience,
    exp: now + 86400,
    sub: 'mailto:notifications@pill-mate.app',
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const unsignedToken = `${jwtHeader}.${jwtPayload}`;
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(unsignedToken)
  );

  const sigArray = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigArray.length === 64) {
    rawSig = sigArray;
  } else {
    rawSig = derToRaw(sigArray);
  }

  const sigBase64 = btoa(String.fromCharCode(...rawSig))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${unsignedToken}.${sigBase64}`;

  const { ciphertext, salt, serverPublicKey } = await encryptPayload(
    subscription.p256dh,
    subscription.auth,
    encoder.encode(payload)
  );

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
    },
    body: ciphertext,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Push failed [${response.status}]: ${text}`);
  }
  
  await response.text();
}

function derToRaw(der: Uint8Array): Uint8Array {
  const raw = new Uint8Array(64);
  let offset = 3;
  const rLen = der[offset];
  offset += 1;
  const rStart = rLen === 33 ? offset + 1 : offset;
  raw.set(der.slice(rStart, rStart + 32), 0);
  offset += rLen + 1;
  const sLen = der[offset];
  offset += 1;
  const sStart = sLen === 33 ? offset + 1 : offset;
  raw.set(der.slice(sStart, sStart + 32), 32);
  return raw;
}

async function encryptPayload(p256dhBase64: string, authBase64: string, payload: Uint8Array) {
  const serverKeys = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  const p256dhBytes = base64UrlToBytes(p256dhBase64);
  const authBytes = base64UrlToBytes(authBase64);

  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    p256dhBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberKey },
    serverKeys.privateKey,
    256
  );

  const serverPublicKeyRaw = await crypto.subtle.exportKey('raw', serverKeys.publicKey);
  const serverPublicKeyBytes = new Uint8Array(serverPublicKeyRaw);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const encoder = new TextEncoder();
  
  const authInfo = new Uint8Array([
    ...encoder.encode('WebPush: info\0'),
    ...p256dhBytes,
    ...serverPublicKeyBytes,
  ]);

  const prkBits = await hkdfExtractAndExpand(new Uint8Array(sharedSecret), authBytes, authInfo, 32);

  const cekInfo = new Uint8Array([...encoder.encode('Content-Encoding: aes128gcm\0')]);
  const nonceInfo = new Uint8Array([...encoder.encode('Content-Encoding: nonce\0')]);

  const cek = await hkdfExtractAndExpand(prkBits, salt, cekInfo, 16);
  const nonce = await hkdfExtractAndExpand(prkBits, salt, nonceInfo, 12);

  const paddedPayload = new Uint8Array(payload.length + 1);
  paddedPayload.set(payload);
  paddedPayload[payload.length] = 2;

  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    paddedPayload
  );

  const rs = payload.length + 17 + 1;
  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, rs + 16, false);
  header[20] = 65;
  header.set(serverPublicKeyBytes, 21);

  const result = new Uint8Array(header.length + encrypted.byteLength);
  result.set(header);
  result.set(new Uint8Array(encrypted), header.length);

  return { ciphertext: result, salt, serverPublicKey: serverPublicKeyBytes };
}

async function hkdfExtractAndExpand(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const body = await req.json().catch(() => ({}));
    const isCron = body.source === 'cron';

    // Get VAPID keys
    const { data: vapidData } = await supabase
      .from('vapid_keys')
      .select('*')
      .limit(1)
      .single();

    if (!vapidData) {
      return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all subscriptions
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let notifications: { key: string; title: string; body: string; tag: string; type: string }[] = [];

    if (isCron) {
      // CRON MODE: Read due reminders from pending_reminders table
      const now = new Date().toISOString();
      const { data: dueReminders, error: remError } = await supabase
        .from('pending_reminders')
        .select('*')
        .eq('sent', false)
        .lte('trigger_at', now);

      if (remError) {
        console.error('Error reading pending_reminders:', remError);
        throw remError;
      }

      if (!dueReminders || dueReminders.length === 0) {
        return new Response(JSON.stringify({ sent: 0, message: 'No reminders due (cron)' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      notifications = dueReminders.map(r => ({
        key: r.notification_key,
        title: r.title,
        body: r.body,
        tag: r.tag,
        type: r.type,
      }));

      // Mark as sent
      const ids = dueReminders.map(r => r.id);
      await supabase.from('pending_reminders').update({ sent: true }).in('id', ids);

    } else if (body.medications || body.appointments) {
      // CLIENT MODE: Process medications and appointments from request body
      const { medications, appointments } = body;
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (medications) {
        for (const med of medications) {
          if (!med.reminderMinutes || med.reminderMinutes <= 0) continue;
          if (todayStr < med.startDate) continue;
          if (med.endDate && todayStr > med.endDate) continue;

          for (const time of med.times) {
            const [h, m] = time.split(':').map(Number);
            const eventTime = new Date(now);
            eventTime.setHours(h, m, 0, 0);
            
            const reminderTime = new Date(eventTime.getTime() - med.reminderMinutes * 60000);
            const diffMs = now.getTime() - reminderTime.getTime();
            
            if (diffMs >= 0 && diffMs <= 120000) {
              const key = `med_${med.id}_${time}_${todayStr}`;
              notifications.push({
                key,
                title: `💊 תזכורת תרופה`,
                body: `${med.name}${med.dosage ? ' ' + med.dosage : ''} - ${time}${med.instruction ? '\n' + med.instruction : ''}`,
                tag: `med_${med.id}_${time}`,
                type: 'med',
              });
            }
          }
        }
      }

      if (appointments) {
        for (const appt of appointments) {
          if (!appt.reminderMinutes || appt.reminderMinutes <= 0) continue;
          if (appt.date !== todayStr) continue;

          const [h, m] = appt.time.split(':').map(Number);
          const eventTime = new Date(now);
          eventTime.setHours(h, m, 0, 0);
          
          const reminderTime = new Date(eventTime.getTime() - appt.reminderMinutes * 60000);
          const diffMs = now.getTime() - reminderTime.getTime();
          
          if (diffMs >= 0 && diffMs <= 120000) {
            const key = `appt_${appt.id}_${todayStr}`;
            notifications.push({
              key,
              title: `🏥 תזכורת תור`,
              body: `${appt.type} - ${appt.time}${appt.doctor ? '\nאצל ' + appt.doctor : ''}${appt.location ? '\nב' + appt.location : ''}`,
              tag: `appt_${appt.id}`,
              type: 'appt',
            });
          }
        }
      }
    } else {
      return new Response(JSON.stringify({ sent: 0, message: 'No events to check' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filter out already-sent notifications (for client mode; cron mode already filtered)
    if (notifications.length > 0 && !isCron) {
      const keys = notifications.map(n => n.key);
      const { data: existing } = await supabase
        .from('notification_log')
        .select('notification_key')
        .in('notification_key', keys);

      const sentKeys = new Set(existing?.map(e => e.notification_key) || []);
      notifications = notifications.filter(n => !sentKeys.has(n.key));
    }

    let sentCount = 0;
    const failedEndpoints: string[] = [];

    for (const notification of notifications) {
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        tag: notification.tag,
        icon: '/favicon.ico',
        type: notification.type,
        data: { type: notification.type },
      });

      for (const sub of subscriptions) {
        try {
          console.log(`Sending push to endpoint: ${sub.endpoint.substring(0, 60)}...`);
          console.log(`Payload: ${payload.substring(0, 100)}`);
          await sendWebPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            payload,
            { publicKey: vapidData.public_key, privateKey: vapidData.private_key }
          );
          console.log(`✅ Push sent successfully!`);
          sentCount++;
        } catch (error) {
          console.error(`❌ Failed to send push:`, error.message);
          if (error.message.includes('410') || error.message.includes('404')) {
            failedEndpoints.push(sub.endpoint);
          }
        }
      }

      // Log as sent (for dedup in client mode)
      if (!isCron) {
        await supabase.from('notification_log').upsert({ notification_key: notification.key });
      }
    }

    // Clean up expired subscriptions
    if (failedEndpoints.length > 0) {
      await supabase.from('push_subscriptions').delete().in('endpoint', failedEndpoints);
    }

    // Clean old data
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString();
    await supabase.from('notification_log').delete().lt('sent_at', twoDaysAgo);
    await supabase.from('pending_reminders').delete().eq('sent', true).lt('trigger_at', twoDaysAgo);

    return new Response(JSON.stringify({ sent: sentCount, checked: notifications.length, mode: isCron ? 'cron' : 'client' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Send notifications error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
