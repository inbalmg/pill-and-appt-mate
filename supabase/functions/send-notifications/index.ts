import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildPushHTTPRequest,
  importVapidKeys,
} from "https://esm.sh/@pushforge/builder@0.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    console.log(`[send-notifications] mode=${isCron ? 'cron' : 'client'}`);

    // Get VAPID keys
    const { data: vapidData } = await supabase
      .from('vapid_keys')
      .select('*')
      .limit(1)
      .single();

    if (!vapidData) {
      console.error('No VAPID keys found');
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
      console.log('No push subscriptions found');
      return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${subscriptions.length} subscription(s)`);

    let notifications: { key: string; title: string; body: string; tag: string; type: string }[] = [];

    if (isCron) {
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

      console.log(`Found ${dueReminders.length} due reminder(s)`);

      notifications = dueReminders.map(r => ({
        key: r.notification_key,
        title: r.title,
        body: r.body,
        tag: r.tag,
        type: r.type,
      }));

      const ids = dueReminders.map(r => r.id);
      await supabase.from('pending_reminders').update({ sent: true }).in('id', ids);

    } else if (body.medications || body.appointments) {
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

    // Filter out already-sent notifications (for client mode)
    if (notifications.length > 0 && !isCron) {
      const keys = notifications.map(n => n.key);
      const { data: existing } = await supabase
        .from('notification_log')
        .select('notification_key')
        .in('notification_key', keys);
      const sentKeys = new Set(existing?.map(e => e.notification_key) || []);
      notifications = notifications.filter(n => !sentKeys.has(n.key));
    }

    console.log(`Processing ${notifications.length} notification(s)`);

    // Import VAPID keys for pushforge
    const vapidPrivateJwk = JSON.parse(vapidData.private_key);
    const vapidKeys = await importVapidKeys({
      subject: 'mailto:notifications@pill-mate.app',
      publicKey: vapidData.public_key,
      privateKey: vapidPrivateJwk.d, // The raw private key 'd' parameter
    });

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
          console.log(`Sending to: ${sub.endpoint.substring(0, 80)}...`);

          const { headers: pushHeaders, body: pushBody, endpoint } = await buildPushHTTPRequest(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            vapidKeys,
            new TextEncoder().encode(payload),
            { ttl: 86400 }
          );

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: pushHeaders,
            body: pushBody,
          });

          if (!response.ok) {
            const text = await response.text();
            throw new Error(`Push failed [${response.status}]: ${text}`);
          }

          console.log(`✅ Push sent successfully (${response.status})`);
          sentCount++;
        } catch (error) {
          console.error(`❌ Push error: ${error.message}`);
          if (error.message.includes('410') || error.message.includes('404')) {
            failedEndpoints.push(sub.endpoint);
          }
        }
      }

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

    console.log(`Done: sent=${sentCount}, checked=${notifications.length}`);

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
