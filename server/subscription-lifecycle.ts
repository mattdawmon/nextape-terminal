import { storage } from "./storage";

const GRACE_PERIOD_DAYS = 3;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

async function processExpiringSubscriptions() {
  try {
    const expiring = await storage.getExpiringSubscriptions();
    for (const sub of expiring) {
      const gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      await storage.updateSubscription(sub.id, {
        status: "grace_period",
        gracePeriodEndsAt,
        lastFailureReason: "Subscription expired - renewal payment needed",
      });
      console.log(`[SubLifecycle] Subscription ${sub.id} for user ${sub.userId} moved to grace period (${GRACE_PERIOD_DAYS} days)`);
    }
  } catch (err) {
    console.error("[SubLifecycle] Error processing expiring subscriptions:", err);
  }
}

async function processGracePeriodExpired() {
  try {
    const expired = await storage.getGracePeriodExpiredSubscriptions();
    for (const sub of expired) {
      await storage.updateSubscription(sub.id, {
        status: "expired",
        lastFailureReason: "Grace period ended - subscription deactivated",
      });
      console.log(`[SubLifecycle] Subscription ${sub.id} for user ${sub.userId} expired after grace period`);
    }
  } catch (err) {
    console.error("[SubLifecycle] Error processing grace period expirations:", err);
  }
}

async function processExpiredPendingPayments() {
  try {
    const expiredPayments = await storage.getExpiredPendingPayments();
    for (const payment of expiredPayments) {
      await storage.updateSubscriptionPayment(payment.id, {
        status: "expired",
        failureReason: "Payment window expired (30 minutes)",
      });
      console.log(`[SubLifecycle] Payment ${payment.id} for user ${payment.userId} expired`);
    }
  } catch (err) {
    console.error("[SubLifecycle] Error processing expired payments:", err);
  }
}

async function runLifecycleCheck() {
  await processExpiringSubscriptions();
  await processGracePeriodExpired();
  await processExpiredPendingPayments();
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startSubscriptionLifecycle() {
  console.log(`[SubLifecycle] Starting subscription lifecycle checker (every ${CHECK_INTERVAL_MS / 1000}s)`);
  runLifecycleCheck();
  intervalId = setInterval(runLifecycleCheck, CHECK_INTERVAL_MS);
}

export function stopSubscriptionLifecycle() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[SubLifecycle] Subscription lifecycle checker stopped");
  }
}
