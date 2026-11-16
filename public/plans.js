export const plans = {
  free: {name: 'Gratis', lei: 0, description: 'Rezumat, explicații, întrebări și caietul tău digital.'},
  monthly: {name: 'Premium lunar', lei: 30, interval: 'month', description: 'Toate funcțiile de învățare, cu facturare lunară.'},
  yearly: {name: 'Premium anual', lei: 300, interval: 'year', monthlyPlan: 'monthly', description: 'Toate funcțiile de învățare, cu facturare anuală.'},
  studentMonthly: {name: 'Elev / student lunar', lei: 20, interval: 'month', student: true, description: 'Tarif redus verificat, cu facturare lunară.'},
  studentYearly: {name: 'Elev / student anual', lei: 200, interval: 'year', student: true, monthlyPlan: 'studentMonthly', description: 'Tarif redus verificat, cu facturare anuală.'},
  lifetime: {name: 'Acces pe viață', lei: 500, description: 'Rezumat, explicații, întrebări și caiet digital, cu o singură plată.'}
};

export function annualSaving(plan) {
  return plan.monthlyPlan ? plans[plan.monthlyPlan].lei * 12 - plan.lei : 0;
}
