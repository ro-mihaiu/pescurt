export const legalCopy = {
  '/termeni': {
    intro: 'Condițiile de utilizare a caietului digital PeScurt și ale serviciilor gratuite oferite.',
    sections: [
      ['Utilizarea serviciului', '<p>PeScurt te ajută să organizezi materiale de studiu și să generezi rezumate, explicații și întrebări. Verifică rezultatele AI folosind materialul original. Ești responsabil pentru accesul la cont și pentru materialele pe care ai dreptul să le încarci.</p>'],
      ['Limită de utilizare', '<p>Fiecare cont poate procesa gratuit până la 2 documente pe zi. Limita se resetează la miezul nopții în fusul orar configurat al serviciului. Donațiile sunt voluntare și nu schimbă limita sau funcțiile contului.</p>'],
      
      ['Materiale și date personale', '<p>Poți șterge materialele din caiet. Pentru detalii despre cont, verificarea statutului și furnizorii implicați, consultă <a class="inline-link" href="/confidentialitate" data-link>Politica de confidențialitate</a>.</p>']
    ]
  },
  '/confidentialitate': {
    intro: 'Cum sunt folosite datele contului, documentele de studiu și documentele justificative.',
    sections: [
      ['Contul și materialele de studiu', '<p>Numele, adresa de email, datele de autentificare și materialele tale sunt folosite pentru a furniza serviciul solicitat. Supabase gestionează conturile și stocarea privată. Când ceri un rezumat, o explicație sau întrebări, materialul ales este transmis API-ului OpenAI pentru generarea rezultatului. Rezultatul este salvat în caiet.</p>'],
      
      
      ['Drepturile tale', '<p>Poți șterge documente din caiet. Poți folosi contactul operatorului pentru a cere, după caz, accesul la date, rectificarea, ștergerea, restricționarea ori portabilitatea acestora sau pentru a formula o opoziție. Poți depune o plângere la <a class="inline-link" href="https://www.dataprotection.ro/">ANSPDCP</a>.</p>']
    ]
  },
  '/cookies': {
    intro: 'Cookie-urile PeScurt mențin sesiunea contului și permit resetarea parolei. Donațiile se deschid pe site-ul extern Ko-fi.',
    sections: [
      ['Cookie-uri esențiale', '<ul><li><code>ps_access</code> păstrează accesul la sesiune până la expirarea tokenului, de regulă o oră.</li><li><code>ps_refresh</code> reînnoiește sesiunea și poate rămâne până la 30 de zile.</li><li><code>ps_recovery</code> identifică sesiunea de resetare a parolei, timp de până la 15 minute.</li></ul><p>Pe HTTPS, aceste nume au prefixul <code>__Host-</code>. Pentru resetarea parolei, și cookie-urile de acces și reînnoire expiră în cel mult 15 minute.</p>'],
      ['Preferințele browserului', '<p>PeScurt folosește cookie-urile descrise aici pentru funcționarea contului. Poți șterge cookie-urile din setările browserului. Blocarea lor poate împiedica autentificarea și resetarea parolei.</p>'],
      
    ]
  }
};
