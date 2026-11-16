import assert from 'node:assert/strict';
import { test } from 'node:test';
import { annualSaving, plans } from '../public/plans.js';
import { validPrice } from '../server/billing.js';

test('checkout validates the published amount, currency and billing interval for every paid plan', () => {
  for (const [id, plan] of Object.entries(plans)) {
    if (id === 'free') continue;
    const price = {
      active: true,
      currency: 'ron',
      unit_amount: plan.lei * 100,
      type: plan.interval ? 'recurring' : 'one_time',
      recurring: plan.interval && {usage_type: 'licensed', interval: plan.interval, interval_count: 1}
    };
    assert.equal(validPrice(id, price), true, id);
    assert.equal(validPrice(id, {...price, unit_amount: price.unit_amount + 1}), false, id);
    assert.equal(validPrice(id, {...price, currency: 'eur'}), false, id);
    if (plan.interval) {
      const wrong = plan.interval === 'month' ? 'year' : 'month';
      assert.equal(validPrice(id, {...price, recurring: {...price.recurring, interval: wrong}}), false, id);
    }
  }
});

test('annual savings compare the annual total against twelve payments of the matching monthly plan', () => {
  assert.equal(annualSaving(plans.yearly), 60);
  assert.equal(annualSaving(plans.studentYearly), 40);
  assert.equal(annualSaving(plans.lifetime), 0);
});
