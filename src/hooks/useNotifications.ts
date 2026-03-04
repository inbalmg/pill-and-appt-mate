import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SW_PATH = '/sw.js';
const CHECK_INTERVAL_MS = 60000; // Check every minute

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if already subscribed
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('הדפדפן לא תומך בהתראות Push');
      return false;
    }

    setIsLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setIsLoading(false);
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register(SW_PATH);
      await navigator.serviceWorker.ready;

      // Get VAPID public key from server
      const { data: vapidData, error: vapidError } = await supabase.functions.invoke('push-subscribe', {
        method: 'GET',
      });

      if (vapidError || !vapidData?.publicKey) {
        throw new Error('Failed to get VAPID key');
      }

      // Convert VAPID key to Uint8Array
      const vapidPublicKey = urlBase64ToUint8Array(vapidData.publicKey);

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidPublicKey.buffer as ArrayBuffer,
      });

      const subJson = subscription.toJSON();

      // Save subscription to server
      const { error: saveError } = await supabase.functions.invoke('push-subscribe', {
        method: 'POST',
        body: {
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        },
      });

      if (saveError) throw saveError;

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Push subscription error:', error);
      setIsLoading(false);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await supabase.functions.invoke('push-subscribe', {
          method: 'DELETE',
          body: { endpoint },
        });
      }
      setIsSubscribed(false);
    } catch (error) {
      console.error('Unsubscribe error:', error);
    }
  }, []);

  // Periodic check - sends medications/appointments to server to check for due notifications
  const startNotificationChecker = useCallback((getMedications: () => any[], getAppointments: () => any[]) => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const check = async () => {
      if (!isSubscribed) return;
      try {
        await supabase.functions.invoke('send-notifications', {
          body: {
            medications: getMedications(),
            appointments: getAppointments(),
          },
        });
      } catch (error) {
        console.error('Notification check error:', error);
      }
    };

    // Check immediately then every minute
    check();
    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSubscribed]);

  return {
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    startNotificationChecker,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
