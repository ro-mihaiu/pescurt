export const legalCopy = {
  '/termeni': {
    intro: 'Condițiile de utilizare a caietului digital PeScurt și ale serviciilor gratuite oferite.',
    sections: [
      ['Utilizarea serviciului', '<p>PeScurt te ajută să organizezi materiale de studiu și să generezi rezumate, explicații și întrebări. Verifică rezultatele AI folosind materialul original. Ești responsabil pentru accesul la cont și pentru materialele pe care ai dreptul să le încarci.</p>'],
      ['Încărcări și reclamații', '<p>După autentificare poți încărca materiale din <a href="/panel" data-link>panou</a>. Pentru probleme tehnice, conținut sau o solicitare privind datele tale, folosește <a href="/reclamatii" data-link>formularul de reclamații</a> ori scrie la <a href="mailto:pescurt.info@gmail.com">pescurt.info@gmail.com</a>. Nu include parole, coduri de acces sau date ale colegilor.</p>'],
      ['Limită de utilizare', '<p>Fiecare cont poate procesa gratuit până la 2 documente pe zi. Limita se resetează la miezul nopții în fusul orar configurat al serviciului. Donațiile sunt voluntare și nu schimbă limita sau funcțiile contului.</p>'],
      
      ['Materiale și date personale', '<p>Poți șterge materialele din caiet. Pentru detalii despre datele contului, încărcări și furnizorii implicați, consultă <a class="inline-link" href="/confidentialitate" data-link>Politica de confidențialitate</a>.</p>']
    ]
  },
  '/confidentialitate': {
    intro: 'Versiunea din 21 noiembrie 2026. Această informare descrie folosirea datelor în PeScurt.',
    sections: [
      ['Contul și materialele de studiu', '<p>Numele, adresa de email, datele de autentificare și materialele tale sunt folosite pentru a furniza serviciul solicitat. Supabase gestionează conturile și stocarea privată. Când ceri un rezumat, o explicație sau întrebări, materialul ales este transmis API-ului OpenAI pentru generarea rezultatului. Rezultatul este salvat în caiet.</p>'],
      
      
      ['De ce prelucrăm datele', '<p>Folosim datele contului și documentele pentru a furniza serviciul pe care îl soliciți (art. 6 alin. 1 lit. b GDPR). Pentru protejarea conturilor și prevenirea abuzurilor ne bazăm pe interesul legitim de a securiza serviciul (lit. f). Înregistrăm identificatorul contului, versiunea termenilor și data acceptării pentru a putea demonstra ce condiții au fost acceptate. Bifa de la înregistrare confirmă citirea informării și acceptarea termenilor.</p>'],
      ['Furnizori și securitate', '<p>Vercel găzduiește site-ul. Cloudflare Turnstile verifică interacțiunea browserului cu formularul de autentificare și primește informații tehnice despre conexiune și dispozitiv. Pentru limitarea încercărilor folosim identificatori calculați din adresa IP sau email. Ferestrele de limitare a autentificării durează până la 15 minute.</p>'],
      ['Reclamații', '<p>La trimiterea formularului, mesajul și adresa de email a contului sunt transmise prin Cloudflare către căsuța Gmail a echipei. Le folosim pentru a răspunde și a soluționa sesizarea, în baza interesului legitim de a gestiona solicitările sau a obligației legale aplicabile. Păstrăm corespondența cât este necesar soluționării și, dacă există un litigiu ori o obligație legală, pe durata necesară acelui scop.</p>'],
      ['Păstrarea datelor', '<p>Materialele rămân în caiet până le ștergi sau ceri ștergerea contului. Evidența acceptării este asociată contului și se șterge din baza activă la ștergerea acestuia. Pentru solicitări privind contul sau corespondența contactează pescurt.info@gmail.com.</p>'],
      ['Drepturile tale', '<p>Poți șterge documente din caiet. Poți folosi contactul operatorului pentru a cere, după caz, accesul la date, rectificarea, ștergerea, restricționarea ori portabilitatea acestora sau pentru a formula o opoziție. Poți depune o plângere la <a class="inline-link" href="https://www.dataprotection.ro/">ANSPDCP</a>.</p>']
    ]
  },
  '/cookies': {
    intro: 'Cookie-urile PeScurt mențin sesiunea contului și permit resetarea parolei. Donațiile se deschid pe site-ul extern Ko-fi.',
    sections: [
      ['Cookie-uri esențiale', '<ul><li><code>ps_access</code> păstrează accesul la sesiune până la expirarea tokenului, de regulă o oră.</li><li><code>ps_refresh</code> reînnoiește sesiunea și poate rămâne până la 30 de zile.</li><li><code>ps_recovery</code> identifică sesiunea de resetare a parolei, timp de până la 15 minute.</li></ul><p>Pe HTTPS, aceste nume au prefixul <code>__Host-</code>. Pentru resetarea parolei, și cookie-urile de acces și reînnoire expiră în cel mult 15 minute.</p>'],
      ['Verificarea anti-robot', '<p>Formularele de autentificare folosesc Cloudflare Turnstile pentru verificări de securitate. Widgetul se încarcă de pe challenges.cloudflare.com. Poți consulta <a href="https://www.cloudflare.com/privacypolicy/">politica Cloudflare</a> pentru informații despre prelucrarea datelor tehnice.</p>'],
      ['Preferințele browserului', '<p>PeScurt folosește cookie-urile descrise aici pentru funcționarea contului. Poți șterge cookie-urile din setările browserului. Blocarea lor poate împiedica autentificarea și resetarea parolei.</p>'],
      
    ]
  }
};
