const { copyFileSync, mkdirSync } = require('node:fs');
const { dirname, join } = require('node:path');

const root = join(__dirname, '..');
const pages = [
  'index.html', 'intro.html', 'zevo.html', 'consultations.html', 'checkout.html', 'checkout-success.html',
  'screen 2 desktop.png', 'screen 2 mobile.png', 'Neon Audit Intelligence Dashboard.png',
  'assets/images/feltus-brand-mark.png', 'assets/images/feltus-hero-art.webp', 'assets/images/feltus-homepage-hero.png',
  'assets/css/styles.css', 'assets/css/brand.css', 'assets/css/feltus-homepage.css', 'assets/css/intro.css', 'assets/css/checkout.css',
  'assets/css/consultations.css', 'assets/js/app.js', 'assets/js/feltus-homepage.js', 'assets/js/consultations.js',
  'assets/js/checkout.js', 'assets/js/payment-status.js'
];

for (const file of pages) {
  const destination = join(root, '.feltus-site', file);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(join(root, file), destination);
}
