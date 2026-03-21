// ABOUTME: Generates the OG image (og-image.png) for social sharing previews.
// ABOUTME: Run with: node scripts/generate-og-image.mjs

const WIDTH = 1200;
const HEIGHT = 630;

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#161619"/>
      <stop offset="100%" stop-color="#1c1c20"/>
    </linearGradient>
    <linearGradient id="accent-line" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="30%" stop-color="#d9534f"/>
      <stop offset="70%" stop-color="#d9534f"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>

  <!-- Subtle dot grid -->
  <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
    <circle cx="16" cy="16" r="0.8" fill="#30303a" opacity="0.5"/>
  </pattern>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)"/>

  <!-- Accent line at top -->
  <rect x="0" y="0" width="${WIDTH}" height="3" fill="url(#accent-line)"/>

  <!-- Logo icon (scaled up) -->
  <g transform="translate(${WIDTH / 2 - 44}, 140)">
    <rect width="88" height="88" rx="16" fill="#222228" stroke="#30303a" stroke-width="1"/>
    <g fill="#e2dfd8">
      <rect x="17" y="19" width="10" height="50" rx="2"/>
      <rect x="17" y="19" width="17" height="9" rx="2"/>
      <rect x="17" y="60" width="17" height="9" rx="2"/>
      <rect x="61" y="19" width="10" height="50" rx="2"/>
      <rect x="54" y="19" width="17" height="9" rx="2"/>
      <rect x="54" y="60" width="17" height="9" rx="2"/>
    </g>
    <rect x="29" y="39" width="30" height="10" rx="3" fill="#d9534f"/>
  </g>

  <!-- App name -->
  <text x="${WIDTH / 2}" y="282" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="52" font-weight="600" fill="#e2dfd8" letter-spacing="-1">Redacta</text>

  <!-- Tagline -->
  <text x="${WIDTH / 2}" y="330" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="22" font-weight="400" fill="#a8a4a0">AI-Powered PDF Redaction &amp; Pseudonymisation</text>

  <!-- Feature pills -->
  <g transform="translate(${WIDTH / 2}, 380)">
    <!-- Free & Open Source -->
    <rect x="-340" y="0" width="160" height="36" rx="18" fill="#222228" stroke="#30303a" stroke-width="1"/>
    <text x="-260" y="24" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="500" fill="#a8a4a0">Free &amp; Open Source</text>

    <!-- Client-Side -->
    <rect x="-160" y="0" width="130" height="36" rx="18" fill="#222228" stroke="#30303a" stroke-width="1"/>
    <text x="-95" y="24" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="500" fill="#a8a4a0">100% Client-Side</text>

    <!-- BYOK -->
    <rect x="-10" y="0" width="160" height="36" rx="18" fill="#222228" stroke="#30303a" stroke-width="1"/>
    <text x="70" y="24" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="500" fill="#a8a4a0">Bring Your Own Key</text>

    <!-- Compliance -->
    <rect x="170" y="0" width="170" height="36" rx="18" fill="#222228" stroke="#30303a" stroke-width="1"/>
    <text x="255" y="24" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="500" fill="#a8a4a0">GDPR · HIPAA · CCPA</text>
  </g>

  <!-- Redact demo bar -->
  <g transform="translate(${WIDTH / 2 - 200}, 460)">
    <rect width="400" height="48" rx="8" fill="#222228" stroke="#30303a" stroke-width="1"/>
    <text x="16" y="30" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" fill="#706c68">e.g.</text>
    <text x="48" y="30" font-family="Helvetica Neue, Arial, sans-serif" font-size="14" fill="#a8a4a0">"Remove all names and emails"</text>
    <rect x="312" y="8" width="76" height="32" rx="6" fill="#d9534f"/>
    <text x="350" y="30" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="13" font-weight="600" fill="#fff">Redact</text>
  </g>

  <!-- URL at bottom -->
  <text x="${WIDTH / 2}" y="568" text-anchor="middle" font-family="Helvetica Neue, Arial, sans-serif" font-size="15" fill="#706c68">github.com/Siddharth-Khattar/redacta</text>

  <!-- Bottom accent line -->
  <rect x="0" y="${HEIGHT - 3}" width="${WIDTH}" height="3" fill="url(#accent-line)"/>
</svg>`;

async function main() {
  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.error("sharp is not installed. Installing...");
    const { execSync } = await import("child_process");
    execSync("npm install --no-save sharp", { stdio: "inherit" });
    sharp = (await import("sharp")).default;
  }

  const buffer = Buffer.from(svg);
  await sharp(buffer)
    .png()
    .toFile("frontend/public/og-image.png");

  console.log("Generated frontend/public/og-image.png (1200x630)");
}

main().catch(console.error);
