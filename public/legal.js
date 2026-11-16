export const legalCopy = {
  '/termeni': {
    intro: 'Condițiile de utilizare a caietului digital PeScurt și ale planurilor plătite.',
    sections: [
      ['Utilizarea serviciului', '<p>PeScurt te ajută să organizezi materiale de studiu și să generezi rezumate, explicații și întrebări. Verifică rezultatele AI folosind materialul original. Ești responsabil pentru accesul la cont și pentru materialele pe care ai dreptul să le încarci.</p>'],
      ['Planuri și facturare', '<p>Planul Gratis include 2 documente procesate pe zi. Planurile plătite includ 5. Limita se resetează la miezul nopții în fusul orar afișat în cont. Pagina <a class="inline-link" href="/preturi" data-link>Prețuri</a> prezintă sumele și perioadele de facturare. Tarifele pentru elevi și studenți se deblochează după verificare manuală.</p><p>Abonamentele se reînnoiesc la sfârșitul fiecărei perioade până la anulare. Poți gestiona anularea în portalul Stripe din Profil. Accesul pe viață implică o singură plată și include funcțiile de studiu și limita zilnică a planului cât timp PeScurt oferă serviciul.</p>'],
      ['Retragere, rambursări și reclamații', '<p>Pentru solicitări privind facturarea, retragerea sau rambursarea, folosește datele de contact ale operatorului și precizează detaliile comenzii. Se aplică drepturile obligatorii ale consumatorului, inclusiv dreptul de retragere atunci când este prevăzut de lege. Anularea reînnoirii din portal și exercitarea dreptului de retragere sunt operațiuni distincte.</p>'],
      ['Materiale și date personale', '<p>Poți șterge materialele din caiet. Pentru detalii despre cont, verificarea statutului și furnizorii implicați, consultă <a class="inline-link" href="/confidentialitate" data-link>Politica de confidențialitate</a>.</p>']
    ]
  },
  '/confidentialitate': {
    intro: 'Cum sunt folosite datele contului, documentele de studiu și documentele justificative.',
    sections: [
      ['Contul și materialele de studiu', '<p>Numele, adresa de email, datele de autentificare și materialele tale sunt folosite pentru a furniza serviciul solicitat. Supabase gestionează conturile și stocarea privată. Când ceri un rezumat, o explicație sau întrebări, materialul ales este transmis API-ului OpenAI pentru generarea rezultatului. Rezultatul este salvat în caiet.</p>'],
      ['Verificarea de elev sau student', '<p>Dacă soliciți tariful redus, un administrator autorizat vede documentul justificativ și înregistrează decizia. Păstrează vizibile doar numele, instituția și valabilitatea. Justificativul rămâne în spațiul privat de verificare și este programat pentru ștergere după perioada de păstrare configurată. Decizia și data ei se păstrează separat pentru administrarea eligibilității.</p>'],
      ['Facturarea', '<p>Când pornești o plată, Stripe primește datele necesare pentru pagina de plată și facturare. Datele cardului se introduc în pagina Stripe. PeScurt păstrează identificatorii de facturare și starea accesului pentru administrarea planului.</p>'],
      ['Drepturile tale', '<p>Poți șterge documente din caiet. Poți folosi contactul operatorului pentru a cere, după caz, accesul la date, rectificarea, ștergerea, restricționarea ori portabilitatea acestora sau pentru a formula o opoziție. Poți depune o plângere la <a class="inline-link" href="https://www.dataprotection.ro/">ANSPDCP</a>.</p>']
    ]
  },
  '/cookies': {
    intro: 'Cookie-urile PeScurt mențin sesiunea contului și permit resetarea parolei.',
    sections: [
      ['Cookie-uri esențiale', '<ul><li><code>ps_access</code> păstrează accesul la sesiune până la expirarea tokenului, de regulă o oră.</li><li><code>ps_refresh</code> reînnoiește sesiunea și poate rămâne până la 30 de zile.</li><li><code>ps_recovery</code> identifică sesiunea de resetare a parolei, timp de până la 15 minute.</li></ul><p>Pe HTTPS, aceste nume au prefixul <code>__Host-</code>. Pentru resetarea parolei, și cookie-urile de acces și reînnoire expiră în cel mult 15 minute.</p>'],
      ['Preferințele browserului', '<p>PeScurt folosește cookie-urile descrise aici pentru funcționarea contului. Poți șterge cookie-urile din setările browserului. Blocarea lor poate împiedica autentificarea și resetarea parolei.</p>'],
      ['Pagina de plată', '<p>Când accesezi Checkout sau portalul de facturare, Stripe își aplică propria <a class="inline-link" href="https://stripe.com/legal/cookies-policy">politică de cookie-uri</a>.</p>']
    ]
  }
};
