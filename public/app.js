const root = document.querySelector('#app');
const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  book: '<path d="M12 6c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V5c-3-1-7-1-10 1v15M5 9h3m-3 4h3m7-8v7l2-1.5 2 1.5V5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2z"/>',
  file: '<path d="M5 3h9l5 5v13H5zM14 3v6h5M8 13h8m-8 4h6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5m-18 4 9 5 9-5"/>',
  spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H5m6-6-6 6 6 6"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  trash: '<path d="M4 6h16M9 6V3h6v3m-9 0 1 15h10l1-15m-8 4v7m4-7v7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m21 16-5-5L6 20"/>',
  note: '<path d="M4 6h16M4 12h16M4 18h11"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ''}</svg>`;
const safe = value => String(value ?? '').replace(/[&<>"']/g, char => (
  {'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]
));
const names = {free: 'Gratis', monthly: 'Premium lunar', yearly: 'Premium anual', student: 'Elev / student', lifetime: 'Acces pe viață'};
const actionNames = {summary: 'Rezumat', explanation: 'Explică-mi', questions: 'Creează întrebări'};
const labels = {pending: 'În așteptarea verificării', approved: 'Aprobat', rejected: 'Respins'};
const routeNames = {
  '/': 'Acasă', '/preturi': 'Prețuri', '/login': 'Autentificare', '/creeaza-cont': 'Creează cont',
  '/recuperare': 'Recuperare parolă', '/parola-noua': 'Parolă nouă', '/confirma': 'Confirmare email',
  '/acasa': 'Acasă', '/caiet': 'Caiet', '/adauga': 'Adaugă document', '/profil': 'Profil',
  '/admin': 'Verificare elevi și studenți'
};
let config = {auth: false, ai: false, prices: {}, zone: 'Europe/Bucharest'};
let auth = {};
let account;
let navigation = 0;
let uploadKind = 'note';
let notebookOffset = 0;
let adminOffset = 0;
let filterTimer;
let activeOutput = 'summary';
let displayedConfirmation;
let configError;

function date(value) {
  return safe(new Intl.DateTimeFormat('ro-RO', {day:'numeric', month:'short', year:'numeric', timeZone: config.zone}).format(new Date(value)));
}

async function api(path, data = {}, download = false) {
  const options = path === 'config' ? {} : {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
  };
  let response;
  try {
    response = await fetch('/api/' + path, options);
  } catch {
    throw new Error('Conexiunea cu serverul a fost întreruptă. Încearcă din nou.');
  }
  if (download && response.ok) {
    const blob = await response.blob();
    const filename = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || 'document';
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || (response.status === 413 ? 'Fișierul depășește limita de 3 MB.' : 'Cererea a eșuat. Încearcă din nou.'));
    error.status = response.status;
    throw error;
  }
  return result;
}

const brand = `<span class="brand-mark"><img src="/icon.svg" alt="" width="36" height="36"></span><span>PeScurt<span class="brand-dot">.</span></span>`;
const buttonLink = (href, label, style = 'primary', symbol = '') =>
  `<a class="button ${style}" href="${href}" data-link>${symbol ? icon(symbol) : ''}${label}</a>`;
const notice = (text, type = '') => `<p class="notice ${type}" role="${type === 'error' ? 'alert' : 'status'}">${safe(text)}</p>`;
const empty = (symbol, heading, text, action = '') =>
  `<div class="empty"><span class="tile">${icon(symbol)}</span><h3>${heading}</h3><p>${text}</p>${action}</div>`;
const loading = () => '<div class="loading" role="status"><span class="spinner"></span> Se încarcă…</div>';
const privateLinks = [['/acasa','home','Acasă'],['/caiet','book','Caiet'],['/adauga','plus','Adaugă'],['/profil','user','Profil']];
const fileInput = 'accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"';

function frame(path, content) {
  const signed = auth.signedIn && !auth.recovery;
  const navigationLinks = privateLinks.map(([href, symbol, label]) => {
    const active = path === href || (href === '/caiet' && path.startsWith('/document/'));
    return `<a href="${href}" data-link ${active ? 'aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span></a>`;
  }).join('');
  root.innerHTML = `<header class="site-header"><div class="header-inner">
    <a class="brand" href="${signed ? '/acasa' : '/'}" data-link aria-label="PeScurt, Acasă">${brand}</a>
    ${signed ? `<nav class="desktop-nav" aria-label="Caietul tău">${navigationLinks}</nav>` : ''}
    <nav class="top-actions" aria-label="Pagini publice">
      <a class="price-link" href="/preturi" data-link ${path === '/preturi' ? 'aria-current="page"' : ''}>Prețuri</a>
      ${signed ? '' : `<a class="login-link" href="/login" data-link>Intră în cont</a>${buttonLink('/creeaza-cont','Creează cont','primary compact')}`}
    </nav>
  </div></header>
  <main class="shell ${signed ? 'signed' : ''}" id="main" tabindex="-1">${content}</main>
  ${signed ? `<nav class="bottom-nav" aria-label="Caietul tău">${navigationLinks}</nav>`
    : `<footer class="site-footer"><div><a class="brand" href="/" data-link>${brand}</a><span>Caietul tău digital</span><a href="/preturi" data-link>Vezi planurile ${icon('arrow')}</a></div></footer>`}`;
}

function landing() {
  return `<section class="hero">
    <div class="hero-copy">
      <div class="eyebrow"><span></span> CAIETUL TĂU DIGITAL</div>
      <h1>Învață mai ușor.<br><em>Pe scurt.</em></h1>
      <p>Adaugă o poză, un PDF sau o notiță și transformă materialul de la școală în rezumate clare, explicații și întrebări de recapitulare.</p>
      <div class="hero-actions">${buttonLink(auth.signedIn ? '/acasa' : '/creeaza-cont', auth.signedIn ? 'Deschide caietul' : 'Începe gratuit','primary','arrow')}
        ${buttonLink('/preturi','Vezi planurile','secondary')}</div>
      <div class="hero-includes">${icon('check')} 2 documente pe zi cu planul Gratis</div>
    </div>
    <div class="hero-art" aria-label="Exemplu de rezumat în caiet">
      <div class="paper-background"></div><div class="art-star">${icon('spark')}</div>
      <article class="sample">
        <div class="paper-holes" aria-hidden="true"></div>
        <div class="sample-top"><span class="tile">${icon('file')}</span><div><span class="sample-label">EXEMPLU DIN CAIET</span><h2>Transformările gazelor</h2></div></div>
        <div class="sample-tags"><span class="tag">Fizică</span><span>Rezumat</span></div>
        <div class="sample-lines">
          <p><strong>Izotermă.</strong> Temperatura rămâne constantă.</p>
          <p><strong>Izobară.</strong> Presiunea rămâne constantă.</p>
          <p><strong>Izocoră.</strong> Volumul rămâne constant.</p>
        </div>
        <div class="sample-question"><span class="mini-icon">${icon('spark')}</span> Ce mărime rămâne constantă într-o transformare izobară?</div>
      </article>
      <div class="art-note">${icon('book')} Întrebare de recapitulare</div>
    </div>
  </section>
  <section class="how" aria-labelledby="how-title">
    <h2 id="how-title">De la material la recapitulare</h2>
    <div class="features">
    ${[
      ['upload', 'Adaugă materialul', 'Încarcă o fotografie sau un PDF ori lipește notițele tale.'],
      ['layers', 'Înțelege materia', 'Citește un rezumat sau cere o explicație cu exemple.'],
      ['book', 'Recapitulează din caiet', 'Testează-te cu întrebări și regăsește materialele după titlu sau materie.']
    ].map(([symbol, title, description]) => `<article class="feature"><span class="tile">${icon(symbol)}</span><div><h3>${title}</h3><p>${description}</p></div></article>`).join('')}
    </div>
  </section>`;
}

function authForm(path) {
  const signup = path === '/creeaza-cont';
  const forgot = path === '/recuperare';
  const reset = path === '/parola-noua';
  const heading = signup ? 'Creează-ți contul' : forgot ? 'Recuperează parola' : reset ? 'Alege o parolă nouă' : 'Bun venit la PeScurt';
  const description = signup ? 'Primul pas către caietul tău digital.' : forgot ? 'Îți trimitem un link de resetare pe email.' :
    reset ? 'Alege o parolă de cel puțin 8 caractere.' : 'Intră în cont ca să continui de unde ai rămas.';
  const disabled = !config.auth || (reset && !auth.recovery);
  return `<section class="auth-wrap"><div class="paper-panel auth-card">
    <div class="auth-brand"><img src="/icon.svg" alt="" width="52" height="52"></div>
    <h1>${heading}</h1><p class="muted">${description}</p>
    ${!config.auth ? notice(configError || 'Autentificarea așteaptă conectarea serviciului de conturi.') :
      reset && !auth.recovery ? notice('Deschide linkul de resetare din email sau cere unul nou.', 'error') : ''}
    <form data-action="${signup ? 'auth/signup' : forgot ? 'auth/forgot' : reset ? 'auth/update' : 'auth/login'}">
      <fieldset ${disabled ? 'disabled' : ''}>
        ${signup ? '<label>Nume<input name="name" autocomplete="name" maxlength="80" required placeholder="Numele tău"></label>' : ''}
        ${reset ? '' : '<label>Email<input type="email" name="email" autocomplete="email" required maxlength="254" placeholder="nume@exemplu.ro"></label>'}
        ${forgot ? '' : `<label>Parolă<input type="password" name="password" autocomplete="${signup || reset ? 'new-password' : 'current-password'}"
          ${signup || reset ? 'minlength="8"' : ''} maxlength="72" required placeholder="••••••••"></label>`}
        ${!signup && !forgot && !reset ? '<a class="inline-link forgot" href="/recuperare" data-link>Ai uitat parola?</a>' : ''}
        <button class="button primary full" type="submit">${signup ? 'Creează cont' : forgot ? 'Trimite linkul' : reset ? 'Salvează parola' : 'Autentifică-te'}</button>
      </fieldset><div data-feedback aria-live="polite"></div>
    </form>
    <div class="auth-switch">${signup ? 'Ai deja cont? <a href="/login" data-link>Intră în cont</a>' :
      forgot || reset ? '<a href="' + (reset ? '/recuperare' : '/login') + '" data-link>' + (reset ? 'Cere alt link' : 'Înapoi la autentificare') + '</a>' :
      'Nu ai cont? <a href="/creeaza-cont" data-link>Creează cont</a>'}</div>
  </div></section>`;
}

function planPage() {
  const descriptions = {
    free: 'Rezumat, explicații, întrebări și caietul tău digital.',
    monthly: 'Toate funcțiile de învățare, cu facturare lunară.',
    yearly: 'Toate funcțiile de învățare, cu facturare anuală.',
    student: 'Tarif redus după verificarea manuală a unui document justificativ.',
    lifetime: 'Rezumat, explicații, întrebări și caiet digital, cu o singură plată.',
  };
  const periods = {month: ['lună','luni'], year:['an','ani'], week:['săptămână','săptămâni'], day:['zi','zile']};
  const order = ['free','monthly','yearly','student','lifetime'];
  return `<section class="page-title centered"><h1>Planuri PeScurt</h1><p>Toate planurile includ rezumate, explicații și întrebări de recapitulare.</p></section>
  <section class="plans" aria-label="Planuri disponibile">${order.map(plan => {
    const price = config.prices[plan];
    const period = price?.interval && periods[price.interval];
    const billingPeriod = period ? (price.count === 1 ? ' / ' + period[0] : ' / ' + price.count + ' ' + period[1]) : '';
    let cta;
    if (plan === 'free') cta = buttonLink(auth.signedIn ? '/acasa' : '/creeaza-cont', 'Folosește Gratis', 'primary');
    else if (plan === 'student' && account?.student?.status !== 'approved') {
      cta = buttonLink(auth.signedIn ? '/profil#student' : '/login?urmator=student', 'Verifică statutul', 'secondary');
    } else if (!price) cta = '<span class="unavailable">Tarif indisponibil momentan</span>';
    else if (!auth.signedIn) cta = buttonLink('/login?urmator=preturi','Intră în cont','secondary');
    else cta = `<form data-action="billing/checkout"><input type="hidden" name="plan" value="${plan}"><button class="button secondary full">Alege planul</button><div data-feedback></div></form>`;
    return `<article class="paper-panel plan ${plan === 'free' ? 'free-plan' : ''}">
      <h2>${names[plan]}</h2>
      <div class="plan-price">${plan === 'free' ? '0 lei' : safe(price?.amount || '—')}<small>${safe(billingPeriod)}</small></div>
      <p>${descriptions[plan]}</p>
      <ul><li>${icon('check')} ${plan === 'free' ? 2 : 5} documente procesate pe zi</li>
      <li>${icon('check')} ${plan === 'free' ? 'Fără plată' : plan === 'lifetime' ? 'Fără reînnoire automată' : plan === 'student' ? 'Doar după aprobare' : 'Anulare din portalul de facturare'}</li></ul>
      <div class="plan-action">${cta}</div>
    </article>`;
  }).join('')}</section>
  <div class="plan-foot">${icon('lock')} ${config.billing ? 'Plățile se fac în pagina securizată Stripe.' : 'Plățile așteaptă configurarea procesatorului Stripe.'}</div>`;
}

function usageCard() {
  const {used, limit, remaining, plan, zone} = account;
  return `<section class="paper-panel usage">
    <div class="usage-row"><span class="tile">${icon('file')}</span><div><h2>Documente azi</h2><p>${used} din ${limit} documente folosite azi</p></div><span class="tag">${names[plan]}</span></div>
    <div class="meter" role="progressbar" aria-label="Documente folosite azi" aria-valuenow="${Math.min(used, limit)}" aria-valuemin="0" aria-valuemax="${limit}">
      ${Array.from({length:limit}, (_, index) => `<span class="${index < used ? 'spent' : ''}"></span>`).join('')}</div>
    <div class="usage-info"><span>${remaining === 0 ? 'Ai folosit toate documentele de azi.' : remaining === 1 ? 'Mai poți procesa un document azi.' : 'Mai poți procesa ' + remaining + ' documente azi.'}</span><span title="Fusul orar al serviciului">${safe(zone)}</span></div>
    ${plan === 'free' ? `<a class="upgrade" href="/preturi" data-link>Vezi Premium <span>Până la 5/zi</span>${icon('arrow')}</a>` : ''}
  </section>`;
}

function documentCards(items) {
  return `<div class="documents">${items.map(doc => `<a class="paper-panel document-card" href="/document/${safe(doc.id)}" data-link>
    <span class="tile">${icon('file')}</span>
    <div><h3>${safe(doc.title)}</h3><div class="document-meta"><span class="tag">${safe(doc.subject)}</span><time datetime="${safe(doc.created_at)}">${date(doc.created_at)}</time></div>
    <p>${doc.deleting ? 'Ștergerea trebuie finalizată.' : safe(doc.summary || 'Rezumatul nu a fost generat încă.')}</p></div>
    ${icon('arrow')}
  </a>`).join('')}</div>`;
}

async function dashboard(ticket) {
  frame('/acasa', `<div class="dashboard-top"><section class="welcome"><div>
    <h1>Salut${account.name ? ', ' + safe(account.name.split(/\s+/)[0]) : ''}!</h1>
    <p>Adună materialele de la școală în caietul tău digital.</p>
    ${buttonLink('/adauga','Adaugă document','primary','plus')}
    </div><span class="welcome-art" aria-hidden="true">${icon('book')}</span></section>${usageCard()}</div>
    <section class="section-recent"><div class="section-heading"><h2>${icon('book')} Documente recente</h2><a href="/caiet" class="inline-link" data-link>Vezi caietul</a></div>
    <div id="recent">${loading()}</div></section>`);
  const {items} = await api('documents/list');
  if (ticket !== navigation) return;
  document.querySelector('#recent').innerHTML = items.length ? documentCards(items.slice(0,4)) :
    empty('book','Caietul tău e gol','Adaugă primul document ca să începi.',buttonLink('/adauga','Adaugă document','secondary','plus'));
}

function notebookPage() {
  return `<section class="page-title title-with-action"><div><h1>Caietul meu</h1><p>Materialele tale de studiu, într-un singur loc.</p></div>
    ${buttonLink('/adauga','Adaugă document','primary','plus')}</section>
    <label class="search">${icon('search')} <input id="notebook-search" type="search" placeholder="Caută după titlu sau materie" aria-label="Caută după titlu sau materie" maxlength="120"></label>
    <div id="notebook-results" aria-live="polite">${loading()}</div>`;
}

function paging(type, offset, more) {
  if (!offset && !more) return '';
  return `<div class="paging">${offset ? `<button class="button secondary compact" data-page="${type}" data-offset="${offset - 20}">Înapoi</button>` : ''}
    ${more ? `<button class="button secondary compact" data-page="${type}" data-offset="${offset + 20}">Mai multe</button>` : ''}</div>`;
}
let notebookFetch = 0;
async function fetchNotebook() {
  const target = document.querySelector('#notebook-results');
  const search = document.querySelector('#notebook-search')?.value;
  if (!target) return;
  const ticket = ++notebookFetch;
  const offset = notebookOffset;
  target.innerHTML = loading();
  try {
    const {items, more} = await api('documents/list', {search, offset});
    if (ticket !== notebookFetch || !target.isConnected) return;
    if (!items.length && offset) {
      notebookOffset = Math.max(0, offset - 20);
      return fetchNotebook();
    }
    target.innerHTML = items.length ? documentCards(items) + paging('notebook', offset, more) :
      empty('search', search ? 'Niciun rezultat' : 'Caietul tău e gol', search ? 'Încearcă alt titlu sau altă materie.' : 'Adaugă o fotografie, un PDF sau o notiță.');
  } catch (error) {
    if (ticket === notebookFetch) target.innerHTML = notice(error.message, 'error');
  }
}

function addPage() {
  return `<section class="page-title"><h1>Adaugă document</h1><p>Salvează materialul în caiet, apoi alege cum vrei să îl studiezi.</p></section>
  <form class="paper-panel form-panel" data-action="documents/add">
    <div class="fields"><label>Titlu<input name="title" placeholder="De exemplu, Transformările gazelor" maxlength="120" required></label>
    <label>Materie<input name="subject" placeholder="De exemplu, Fizică" maxlength="60" required></label></div>
    <fieldset class="source-choices"><legend>Sursa documentului</legend>
      <label><input type="radio" name="kind" value="note" checked><span>${icon('note')} Notiță</span></label>
      <label><input type="radio" name="kind" value="file"><span>${icon('upload')} Poză sau PDF</span></label>
    </fieldset>
    <div data-source="note"><label>Notița ta<textarea name="note" rows="8" maxlength="24000" placeholder="Scrie sau lipește notița aici…" required></textarea></label></div>
    <div data-source="file" hidden>${fileControl('Atașează un PDF sau o fotografie', false)}</div>
    <div class="form-end"><button class="button primary" type="submit">${icon('check')} Salvează în caiet</button></div>
    <div data-feedback aria-live="polite"></div>
  </form>`;
}

function fileControl(label, required = true) {
  return `<label class="file-drop"><span class="tile">${icon('upload')}</span><strong>${label}</strong>
    <span>PDF, JPG, PNG sau WebP · maximum 3 MB</span><input type="file" name="file" ${fileInput} ${required ? 'required' : 'disabled'}></label>`;
}

function outputPanel(doc, key) {
  const output = doc.outputs[key];
  return `<section class="paper-panel form-panel output" aria-label="${actionNames[key]}">
    <h2>${actionNames[key]}</h2>
    ${output ? `<div class="result-text">${safe(output)}</div>`
      : `<p class="muted">${config.ai ? 'Generează acest rezultat pe baza materialului salvat.' : 'Procesarea AI așteaptă conectarea serviciului.'}</p>
      <form data-action="documents/process"><input type="hidden" name="id" value="${safe(doc.id)}"><input type="hidden" name="action" value="${key}">
      <button class="button primary" ${config.ai ? '' : 'disabled'}>${icon('spark')} ${key === 'questions' ? 'Creează întrebări' : key === 'summary' ? 'Generează rezumat' : 'Generează explicație'}</button>
      <div data-feedback aria-live="polite"></div></form>`}
  </section>`;
}

let openedDocument;
function documentPage(doc) {
  return `<a class="back-link inline-link" href="/caiet" data-link>${icon('back')} Înapoi la caiet</a>
  <section class="page-title title-with-action"><div><h1>${safe(doc.title)}</h1>
    <p><span class="tag">${safe(doc.subject)}</span> <time datetime="${safe(doc.created_at)}">${date(doc.created_at)}</time></p></div>
    <form data-action="documents/delete"><input type="hidden" name="id" value="${safe(doc.id)}">
      <button class="button danger compact">${icon('trash')} Șterge</button><div data-feedback aria-live="polite"></div></form></section>
    ${doc.deleting ? notice('Ștergerea a fost începută. Apasă Șterge pentru a încerca din nou.') : `<div class="document-layout">
    <div><div class="tool-tabs" role="group" aria-label="Instrumente de învățare">
      ${Object.entries(actionNames).map(([key, label]) => `<button class="button secondary compact" type="button" data-output="${key}" aria-pressed="${key === activeOutput}">${label}</button>`).join('')}
    </div><div id="output-panel">${outputPanel(doc, activeOutput)}</div></div>
    <section class="paper-panel form-panel source"><h2>Materialul original</h2>
      ${doc.note !== null ? `<div class="result-text">${safe(doc.note)}</div>` :
        `<form data-action="documents/original"><input type="hidden" name="id" value="${safe(doc.id)}">
        <button class="button secondary">${icon('file')} Descarcă fișierul</button><div data-feedback aria-live="polite"></div></form>`}
    </section></div>`}`;
}

function studentText(student) {
  if (!student) return 'Trimite un document pentru a solicita tariful redus. Un administrator verifică manual cererea.';
  if (student.status === 'approved') return 'Statutul tău a fost verificat. Acum poți alege planul la tarif redus.';
  if (student.status === 'rejected') return student.reason || 'Documentul trimis nu a putut confirma statutul. Poți depune o cerere nouă.';
  return 'Cererea este în așteptare. Un administrator va verifica manual documentul încărcat.';
}

function profilePage() {
  const student = account.student;
  return `<section class="page-title"><h1>Profilul meu</h1><p>Cont, consum și preferințe de facturare.</p></section>
  ${new URLSearchParams(location.search).get('plata') === 'asteptare' ? notice('Planul se actualizează după ce primim confirmarea de la Stripe.') : ''}
  <div class="profile-grid">${usageCard()}
  <section class="paper-panel form-panel"><h2>Abonament</h2><p class="muted">Planul curent este <strong>${names[account.plan]}</strong>.</p>
    ${config.billing ? '<form data-action="billing/portal"><button class="button secondary">Gestionează abonamentul</button><div data-feedback aria-live="polite"></div></form>'
      : notice('Gestionarea abonamentului așteaptă configurarea Stripe.')}
    <a class="inline-link" href="/preturi" data-link>Compară planurile</a>
  </section>
  <section class="paper-panel form-panel" id="student"><h2>Verificare elev / student</h2>
    ${student ? `<span class="tag status-${safe(student.status)}">${labels[student.status]}</span>` : ''}
    <p class="muted">${safe(studentText(student))}</p>
    ${student?.reviewed_at ? `<p class="muted">Decizie înregistrată la ${date(student.reviewed_at)}.</p>` : ''}
    ${!student || student.status === 'rejected' ? `
      <p>Poți trimite un carnet de elev vizat, o adeverință sau o legitimație de student valabilă.
      Lasă vizibile numele, instituția și valabilitatea. Folosește în profil numele care apare pe document. Acoperă CNP-ul, adresa, seria și celelalte date care nu sunt necesare.</p>
      <form data-action="student/apply">${fileControl('Alege documentul justificativ')}
      <button class="button primary">Trimite spre verificare</button><div data-feedback aria-live="polite"></div></form>` :
      student.status === 'approved' ? buttonLink('/preturi', 'Vezi tariful pentru elevi / studenți','secondary') : ''}
  </section>
  <section class="paper-panel form-panel"><h2>Setările contului</h2><p class="muted break-word">${safe(account.email)}</p>
    <form data-action="auth/update"><label>Nume<input name="name" value="${safe(account.name)}" maxlength="80" autocomplete="name" required></label>
      <button class="button secondary">Salvează numele</button><div data-feedback aria-live="polite"></div></form>
    <details><summary>Schimbă parola</summary><form data-action="auth/update">
      <label>Parola actuală<input name="currentPassword" type="password" autocomplete="current-password" maxlength="72" required></label>
      <label>Parola nouă<input name="password" type="password" autocomplete="new-password" minlength="8" maxlength="72" required></label>
      <button class="button secondary">Schimbă parola</button><div data-feedback aria-live="polite"></div></form></details>
    <form data-action="auth/logout"><button class="button danger">Deconectează-te</button><div data-feedback aria-live="polite"></div></form>
    ${account.administrator ? buttonLink('/admin','Administrare verificări','secondary','lock') : ''}
  </section></div>`;
}

function adminPage() {
  return `<section class="page-title"><h1>Verificări elev / student</h1><p>Consultă cererile și înregistrează decizia.</p></section>
  <section class="paper-panel form-panel"><div class="fields">
    <label>Starea cererii<select id="admin-filter">${Object.entries(labels).map(([key,label]) => `<option value="${key}">${label}</option>`).join('')}</select></label>
    <form data-action="admin/purge"><button class="button secondary">Șterge documentele expirate</button><div data-feedback aria-live="polite"></div></form>
  </div></section><div id="admin-results" aria-live="polite">${loading()}</div>`;
}

let adminFetch = 0;
async function fetchAdmin() {
  const target = document.querySelector('#admin-results');
  if (!target) return;
  const ticket = ++adminFetch;
  const status = document.querySelector('#admin-filter').value;
  const offset = adminOffset;
  target.innerHTML = loading();
  try {
    const {items, more} = await api('admin/list', {status, offset});
    if (!target.isConnected || ticket !== adminFetch) return;
    if (!items.length && offset) { adminOffset = Math.max(0, offset - 20); return fetchAdmin(); }
    target.innerHTML = items.length ? items.map(item => {
      const id = safe(item.id);
      const expired = new Date(item.expires_at) <= new Date();
      const hiddenId = `<input type="hidden" name="id" value="${id}">`;
      return `<article class="paper-panel form-panel admin-item"><h2>Cerere din ${date(item.created_at)}</h2>
        <p>${safe(item.applicant_name)}</p><p><span class="tag status-${safe(item.status)}">${labels[item.status]}</span></p>
        <p class="muted">${item.reviewed_at ? 'Decizie din ' + date(item.reviewed_at) + ' · ' : ''}Păstrare până la ${date(item.expires_at)}.</p>
        ${item.reason ? `<p>${safe(item.reason)}</p>` : ''}
        ${item.file_type && !expired ? `<form data-action="admin/proof">${hiddenId}<button class="button secondary compact">${icon('lock')} Descarcă documentul</button><div data-feedback></div></form>` : ''}
        ${item.status === 'pending' && !expired ? `<form data-action="admin/decide">${hiddenId}
          <label>Motivul respingerii<textarea name="reason" rows="2" maxlength="500" placeholder="Completează dacă respingi cererea"></textarea></label>
          <div class="form-end"><button class="button primary compact" name="status" value="approved">Aprobă</button>
          <button class="button danger compact" name="status" value="rejected">Respinge</button></div><div data-feedback></div></form>` : ''}
        ${item.file_type && (item.status !== 'pending' || expired) ? `<form data-action="admin/remove">${hiddenId}<button class="button danger compact">Șterge documentul justificativ</button><div data-feedback></div></form>` : ''}
        ${!item.file_type ? '<p class="muted">Documentul justificativ a fost șters.</p>' : ''}
      </article>`;
    }).join('') + paging('admin', offset, more) : empty('lock','Nu sunt cereri în această stare','Poți verifica celelalte stări din filtru.');
  } catch (error) {
    if (ticket === adminFetch) target.innerHTML = notice(error.message, 'error');
  }
}

async function show(focus = false) {
  const ticket = ++navigation;
  let path = location.pathname.replace(/\/$/, '') || '/';
  const isDocument = /^\/document\/[^/]+$/.test(path);
  const needsAccount = isDocument || ['/acasa','/caiet','/adauga','/profil','/admin'].includes(path);
  document.title = (routeNames[path] || (isDocument ? 'Document' : 'Pagină indisponibilă')) + ' · PeScurt';
  if (path === '/confirma') {
    const params = new URLSearchParams(location.search);
    if (params.has('token_hash')) {
      displayedConfirmation = {type: params.get('type'), token: params.get('token_hash')};
      history.replaceState({}, '', '/confirma');
    }
    frame(path, `<div class="paper-panel form-panel confirm-panel"><h1>Confirmă linkul primit</h1>
      ${displayedConfirmation ? `<form data-action="auth/confirm"><button class="button primary">Continuă</button><div data-feedback aria-live="polite"></div></form>` :
        notice('Deschide din nou linkul primit pe email.')}</div>`);
  } else if (auth.recovery && needsAccount) {
    return go('/parola-noua', true);
  } else if (needsAccount && !auth.signedIn) {
    return go('/login', true);
  } else if (path === '/') frame(path, landing());
  else if (['/login','/creeaza-cont','/recuperare','/parola-noua'].includes(path)) frame(path, authForm(path));
  else if (!needsAccount && path !== '/preturi') frame(path, empty('book','Pagina nu a fost găsită','Alege o pagină din meniu.',buttonLink('/','Mergi la Acasă')));
  else {
    frame(path, loading());
    try {
      if (auth.signedIn && !auth.recovery) account = await api('account');
      if (ticket !== navigation) return;
      if (path === '/preturi') frame(path, planPage());
      else if (path === '/acasa') await dashboard(ticket);
      else if (path === '/caiet') {
        notebookOffset = 0;
        frame(path, notebookPage());
        await fetchNotebook();
      } else if (path === '/adauga') {
        uploadKind = 'note';
        frame(path, addPage());
      } else if (path === '/profil') frame(path, profilePage());
      else if (path === '/admin') {
        adminOffset = 0;
        frame(path, account.administrator ? adminPage() : notice('Ai nevoie de acces de administrator.', 'error'));
        if (account.administrator) await fetchAdmin();
      } else if (isDocument) {
        const doc = await api('documents/get', {id: path.split('/').at(-1)});
        if (ticket !== navigation) return;
        openedDocument = doc;
        activeOutput = 'summary';
        frame(path, documentPage(doc));
      }
    } catch (error) {
      if (ticket !== navigation) return;
      if (error.status === 401) {
        auth = {};
        account = undefined;
        if (needsAccount) return go('/login', true);
      }
      frame(path, path === '/preturi' ? planPage() : `<div class="error-panel">${notice(error.message, 'error')}
        ${buttonLink(path === '/caiet' ? '/acasa' : '/caiet','Revino','secondary')}</div>`);
    }
  }
  if (ticket !== navigation) return;
  if (focus) document.querySelector('#main')?.focus({preventScroll: true});
  if (location.hash === '#student') document.querySelector('#student')?.scrollIntoView();
}

function go(href, replace = false) {
  const next = new URL(href, location.origin);
  history[replace ? 'replaceState' : 'pushState']({}, '', next.pathname + next.search + next.hash);
  window.scrollTo(0, 0);
  return show(true);
}
window.addEventListener('popstate', () => show(true));

root.addEventListener('click', event => {
  const link = event.target.closest('[data-link]');
  if (link && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
    event.preventDefault();
    go(link.href);
  }
  const output = event.target.closest('[data-output]');
  if (output && openedDocument && !document.querySelector('#output-panel form[aria-busy="true"]')) {
    activeOutput = output.dataset.output;
    for (const tab of root.querySelectorAll('[data-output]')) tab.setAttribute('aria-pressed', tab === output);
    document.querySelector('#output-panel').innerHTML = outputPanel(openedDocument, activeOutput);
  }
  const page = event.target.closest('[data-page]');
  if (page?.dataset.page === 'notebook') {
    notebookOffset = Number(page.dataset.offset);
    fetchNotebook();
  } else if (page?.dataset.page === 'admin') {
    adminOffset = Number(page.dataset.offset);
    fetchAdmin();
  }
});

root.addEventListener('input', event => {
  if (event.target.id === 'notebook-search') {
    clearTimeout(filterTimer);
    notebookOffset = 0;
    filterTimer = setTimeout(fetchNotebook, 250);
  }
});
root.addEventListener('change', event => {
  if (event.target.name === 'kind') {
    uploadKind = event.target.value;
    for (const source of root.querySelectorAll('[data-source]')) {
      source.hidden = source.dataset.source !== uploadKind;
      const input = source.querySelector('input,textarea');
      input.disabled = source.hidden;
      input.required = !source.hidden;
    }
  } else if (event.target.id === 'admin-filter') {
    adminOffset = 0;
    fetchAdmin();
  }
});

async function base64(file) {
  if (!file?.size) throw new Error('Alege un fișier înainte să continui.');
  if (file.size > 3 * 1024 * 1024) throw new Error('Fișierul trebuie să aibă maximum 3 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.toBase64) return bytes.toBase64();
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

root.addEventListener('submit', async event => {
  const form = event.target.closest('form[data-action]');
  if (!form) return;
  event.preventDefault();
  if (form.getAttribute('aria-busy') === 'true') return;
  const action = form.dataset.action;
  if (['documents/delete', 'admin/remove'].includes(action) &&
      !window.confirm(action === 'documents/delete' ? 'Ștergi definitiv acest document?' : 'Ștergi definitiv documentul justificativ?')) return;
  const ticket = navigation;
  const nextPath = new URLSearchParams(location.search).get('urmator');
  const payload = Object.fromEntries(new FormData(form));
  if (event.submitter?.name) payload[event.submitter.name] = event.submitter.value;
  if (action === 'auth/confirm') Object.assign(payload, displayedConfirmation);
  const buttons = [...form.querySelectorAll('button:not([disabled])')];
  form.setAttribute('aria-busy','true');
  buttons.forEach(button => button.disabled = true);
  const feedback = form.querySelector('[data-feedback]');
  if (feedback) feedback.innerHTML = `<p class="loading inline-loading" role="status"><span class="spinner"></span>${action === 'documents/process' ? 'Se procesează materialul…' : 'Se trimite…'}</p>`;
  try {
    if (payload.file instanceof File) payload.file = await base64(payload.file);
    const result = await api(action, payload, ['documents/original', 'admin/proof'].includes(action));
    if (ticket !== navigation) return;
    if (!result) { if (feedback) feedback.replaceChildren(); return; }
    if (result.url) {
      const target = new URL(result.url);
      if (!['checkout.stripe.com', 'billing.stripe.com'].includes(target.hostname) || target.protocol !== 'https:') {
        throw new Error('Linkul de facturare este indisponibil.');
      }
      location.assign(target.href);
      return;
    }
    if (action === 'auth/logout') {
      auth = {};
      account = undefined;
      return go('/');
    }
    if (action === 'auth/confirm') displayedConfirmation = undefined;
    if (result.next) {
      auth = await api('auth/session');
      account = undefined;
      return go(result.next === '/acasa' && nextPath === 'student' ? '/profil#student' :
        result.next === '/acasa' && nextPath === 'preturi' ? '/preturi' : result.next);
    }
    if (action === 'documents/add') return go('/document/' + result.id);
    if (action === 'documents/delete') return go('/caiet');
    if (action === 'documents/process') {
      openedDocument.outputs[payload.action] = result.output;
      document.querySelector('#output-panel').innerHTML = outputPanel(openedDocument, activeOutput);
      return;
    }
    if (action.startsWith('admin/')) {
      await fetchAdmin();
      if (feedback?.isConnected) feedback.innerHTML = notice(result.message || 'Documente șterse: ' + result.deleted + '.');
      return;
    }
    if (action === 'student/apply') return show();
    if (feedback) feedback.innerHTML = notice(result.message || 'Modificarea a fost salvată.');
    if (action === 'auth/signup') form.reset();
  } catch (error) {
    if (feedback) feedback.innerHTML = notice(error.message, 'error');
  } finally {
    buttons.forEach(button => button.disabled = false);
    form.removeAttribute('aria-busy');
  }
});

frame(location.pathname, loading());
try {
  config = await api('config');
  if (config.auth) auth = await api('auth/session');
} catch (error) {
  configError = error.message;
}
await show();
