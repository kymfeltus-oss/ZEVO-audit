param(
    [string]$ProjectPath = "C:\Users\kymfe\OneDrive\Desktop\Zevo Audit",
    [string]$ContactEmail = ""
)

$ErrorActionPreference = "Stop"
$indexPath = Join-Path $ProjectPath "index.html"

if (-not (Test-Path -LiteralPath $indexPath)) {
    throw "index.html was not found at: $indexPath"
}

$html = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8

if ($html.Contains('<!-- ZEVO_AUDIT_LANDING_START -->')) {
    Write-Host "Landing page is already installed. No changes made." -ForegroundColor Yellow
    exit 0
}

$required = @('</style>', '<body>', '<div class="app">', '</body>')
foreach ($marker in $required) {
    if (-not $html.Contains($marker)) {
        throw "Required marker not found in index.html: $marker"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $ProjectPath "index.backup-$timestamp.html"
Copy-Item -LiteralPath $indexPath -Destination $backupPath
Write-Host "Backup created: $backupPath" -ForegroundColor DarkGray

$contactNav = ""
if ($ContactEmail.Trim()) {
    $safeEmail = [System.Net.WebUtility]::HtmlEncode($ContactEmail.Trim())
    $contactNav = '<a class="audit-cover-nav-link" href="mailto:' + $safeEmail + '">Contact</a>'
}

$css = @'

/* ===== ZEVO AUDIT LANDING / COVER ===== */
.audit-app-hidden{display:none!important}
.audit-landing[hidden]{display:none!important}
body.audit-landing-open{background:#050507;overflow-x:hidden}
.audit-landing{
  --al-bg:#050507;--al-panel:#0d0d14;--al-panel2:#11101a;--al-line:#2d2940;
  --al-text:#f7f5fb;--al-muted:#b3acbc;--al-soft:#827b8d;--al-purple:#b566ff;
  --al-purple2:#7d38ee;--al-glow:rgba(164,83,255,.24);
  min-height:100vh;color:var(--al-text);background:
  radial-gradient(circle at 78% 12%,rgba(123,49,231,.22),transparent 27%),
  radial-gradient(circle at 12% 35%,rgba(128,61,217,.11),transparent 25%),
  linear-gradient(180deg,#07070b 0%,#050507 45%,#08070c 100%);
  font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;position:relative;overflow:hidden
}
.audit-landing:before,.audit-landing:after{content:"";position:absolute;pointer-events:none;border-radius:50%;filter:blur(1px)}
.audit-landing:before{width:920px;height:420px;right:-270px;top:118px;border:1px solid rgba(189,116,255,.38);box-shadow:0 0 55px rgba(142,68,255,.16);transform:rotate(-13deg)}
.audit-landing:after{width:780px;height:320px;left:-260px;top:470px;border-top:1px solid rgba(188,103,255,.42);box-shadow:0 -16px 54px rgba(134,55,240,.13);transform:rotate(-10deg)}
.audit-cover-shell{width:min(1480px,calc(100% - 52px));margin:0 auto;position:relative;z-index:1}
.audit-cover-header{height:92px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.09);gap:28px}
.audit-cover-brand{display:flex;align-items:center;gap:23px;min-width:0}.audit-cover-brandmark{display:flex;gap:5px;align-items:center}.audit-cover-brandmark i{display:block;width:7px;height:31px;border-radius:9px;background:linear-gradient(#d27cff,#8b3af4);transform:skew(-22deg)}
.audit-cover-brandname{font-weight:820;font-size:19px;letter-spacing:.22em;white-space:nowrap}.audit-cover-divider{width:1px;height:34px;background:#5b5364}.audit-cover-intel{font-size:11px;letter-spacing:.27em;color:#c3bdc9;font-weight:700;white-space:nowrap}
.audit-cover-nav{display:flex;align-items:center;gap:38px}.audit-cover-nav button,.audit-cover-nav-link{font:inherit;border:0;background:transparent;color:#eeeaf3;font-size:13px;text-decoration:none;padding:12px 0;position:relative;cursor:pointer}.audit-cover-nav button:hover,.audit-cover-nav-link:hover{color:white}.audit-cover-nav button:first-child:after{content:"";position:absolute;left:0;right:0;bottom:3px;height:2px;background:linear-gradient(90deg,#9f4aff,#d58aff);box-shadow:0 0 12px #9f4aff}
.audit-cover-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(460px,.92fr);gap:70px;align-items:center;padding:74px 0 67px;min-height:650px;border-bottom:1px solid rgba(255,255,255,.08)}
.audit-cover-eyebrow{display:inline-flex;align-items:center;padding:9px 16px;border:1px solid rgba(179,98,255,.36);border-radius:7px;background:rgba(100,44,144,.18);font-size:11px;letter-spacing:.22em;font-weight:820;color:#d799ff}.audit-cover-copy h1{font-size:clamp(48px,5.8vw,82px);letter-spacing:-.055em;line-height:.96;margin:26px 0 13px;font-weight:850}.audit-cover-subtitle{font-size:clamp(24px,2.2vw,34px);color:#d3ccd9;letter-spacing:-.03em;margin-bottom:26px}.audit-cover-lede{max-width:670px;color:#ddd9e2;font-size:16px;line-height:1.65;margin:0 0 28px}.audit-cover-credit{display:inline-flex;align-items:center;gap:12px;border:1px solid #625b70;border-radius:10px;padding:11px 16px;color:#f0ebf6;background:rgba(11,10,16,.52);font-size:13px}.audit-cover-credit-icon{color:#ca80ff;font-size:18px}.audit-cover-actions{display:flex;flex-wrap:wrap;gap:15px;margin-top:35px}.audit-cover-primary,.audit-cover-secondary{border-radius:11px;padding:16px 22px;min-height:54px;font:inherit;font-weight:800;font-size:14px;display:inline-flex;align-items:center;gap:22px;cursor:pointer}.audit-cover-primary{border:1px solid #d796ff;background:linear-gradient(135deg,#d783ff,#9c45ee);color:#100b15;box-shadow:0 13px 38px rgba(155,67,238,.22)}.audit-cover-primary:hover{transform:translateY(-2px);filter:brightness(1.06)}.audit-cover-secondary{border:1px solid #766487;background:rgba(13,12,20,.76);color:white}.audit-cover-secondary:hover{border-color:#b078e9;background:#15101d;transform:translateY(-2px)}
.audit-intel-card{border:1px solid rgba(178,112,255,.48);background:linear-gradient(145deg,rgba(20,17,30,.96),rgba(8,8,13,.96));border-radius:22px;padding:21px;box-shadow:0 30px 70px rgba(0,0,0,.42),0 0 44px rgba(131,58,238,.12);transform:perspective(1200px) rotateY(-2deg);position:relative}.audit-intel-card:before{content:"";position:absolute;inset:-1px;border-radius:22px;background:linear-gradient(135deg,rgba(201,133,255,.4),transparent 28%,transparent 70%,rgba(122,53,234,.25));z-index:-1;filter:blur(1px)}
.audit-intel-head{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:3px 4px 15px}.audit-intel-title{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:760}.audit-layer-icon{color:#ca8aff;font-size:20px}.audit-corp-pill{font-size:9px;letter-spacing:.08em;border:1px solid #51445f;border-radius:8px;padding:7px 10px;color:#eee6f8;background:#181220}
.audit-intel-main{display:grid;grid-template-columns:1fr 1.08fr;gap:16px;border:1px solid #353044;border-radius:16px;padding:22px}.audit-ring{width:180px;height:180px;border-radius:50%;margin:auto;display:grid;place-items:center;background:conic-gradient(#d27aff 0 72%,#813ae9 72% 100%);box-shadow:0 0 32px rgba(171,85,255,.22);position:relative}.audit-ring:before{content:"";position:absolute;inset:21px;border-radius:50%;background:#0d0c13;border:1px solid #2c2836}.audit-ring-inner{position:relative;z-index:1;text-align:center}.audit-ring-inner small{display:block;font-size:9px;letter-spacing:.1em;font-weight:800;line-height:1.3}.audit-ring-inner strong{display:block;font-size:42px;letter-spacing:-.06em;margin-top:4px}.audit-checklist{display:grid;align-content:center;gap:11px}.audit-check{display:flex;align-items:center;gap:10px;color:#eeeaf4;font-size:12px}.audit-check i{font-style:normal;width:22px;height:22px;display:grid;place-items:center;border:1px solid #6b4f79;background:#2a1d33;color:#e0b1ff;border-radius:5px;font-size:12px}
.audit-intel-bottom{display:grid;grid-template-columns:.85fr 1.15fr;gap:15px;margin-top:16px}.audit-bars,.audit-risk-signal{border:1px solid #363044;border-radius:13px;background:#0e0d14;min-height:113px;padding:18px}.audit-bars{display:flex;align-items:end;gap:8px}.audit-bars i{display:block;width:15px;background:linear-gradient(#d47fff,#7431dd);box-shadow:0 0 12px rgba(177,84,255,.18)}.audit-bars i:nth-child(1){height:22px}.audit-bars i:nth-child(2){height:34px}.audit-bars i:nth-child(3){height:47px}.audit-bars i:nth-child(4){height:62px}.audit-bars i:nth-child(5){height:78px}.audit-bars i:nth-child(6){height:95px}.audit-risk-signal small{font-size:9px;letter-spacing:.14em;font-weight:800;color:#d3c9df}.audit-risk-row{display:flex;align-items:center;gap:12px;margin:9px 0 14px}.audit-warning{font-size:28px;color:#b968ff}.audit-risk-row strong{font-size:22px;color:#cf7dff}.audit-risk-meter{display:grid;grid-template-columns:repeat(5,1fr);gap:5px}.audit-risk-meter i{height:8px;border-radius:99px;background:#8e43e8}.audit-risk-meter i:nth-child(1),.audit-risk-meter i:nth-child(2),.audit-risk-meter i:nth-child(3),.audit-risk-meter i:nth-child(4){background:linear-gradient(90deg,#c86fff,#8d43e6)}.audit-risk-meter i:last-child{background:#3d354b}
.audit-cover-section{padding:46px 0}.audit-cover-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.audit-cover-card{border:1px solid #373246;border-radius:16px;background:linear-gradient(145deg,#0d0d14,#11101a);padding:26px 27px;min-height:212px}.audit-cover-card-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:11px;border:1px solid #67427f;background:linear-gradient(145deg,#382242,#21152b);color:#d98cff;font-size:25px}.audit-cover-card h2{font-size:22px;letter-spacing:-.035em;margin:21px 0 10px}.audit-cover-card p{font-size:14px;line-height:1.6;color:#c3bcc9;margin:0}
.audit-cover-metrics{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #363041;border-radius:15px;background:#0d0c13;overflow:hidden;margin-top:26px}.audit-cover-metric{text-align:center;padding:20px 15px;border-right:1px solid #36303e}.audit-cover-metric:last-child{border-right:0}.audit-cover-metric strong{display:block;color:#cb7cff;font-size:33px;line-height:1}.audit-cover-metric span{display:block;font-size:14px;margin-top:9px}.audit-cover-metric .audit-metric-icon{font-size:27px;color:#c678ff}
.audit-cover-summary{display:grid;grid-template-columns:.92fr 1.08fr;gap:36px;border:1px solid #393145;border-radius:17px;background:linear-gradient(145deg,#0b0b11,#0f0d16);padding:32px;margin-bottom:68px}.audit-cover-summary h2{font-size:36px;letter-spacing:-.045em;margin:0 0 15px}.audit-cover-summary p{color:#d0c9d5;font-size:14px;line-height:1.65;margin:0;max-width:570px}.audit-cover-summary-copy:after{content:"";display:block;width:150px;height:2px;background:linear-gradient(90deg,#a94af1,transparent);margin-top:26px}.audit-evidence-head{display:flex;align-items:center;gap:14px;color:#c892ff;font-size:10px;letter-spacing:.22em;font-weight:800;margin-bottom:17px}.audit-evidence-head:after{content:"";height:1px;flex:1;background:#54495e}.audit-evidence-previews{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.audit-doc{border:1px solid #3b3545;border-radius:12px;background:#121019;padding:10px}.audit-doc-paper{height:112px;border-radius:7px;background:linear-gradient(#e6e4e9,#bcb8c3);padding:10px;color:#25222b;position:relative;overflow:hidden}.audit-doc-paper:before{content:"ZEVO CORP";display:block;font-size:7px;font-weight:900;margin-bottom:9px}.audit-doc-paper i{display:block;height:4px;background:#77717d;margin:5px 0;opacity:.5}.audit-doc-paper i:nth-child(2){width:82%}.audit-doc-paper i:nth-child(3){width:68%}.audit-doc-paper i:nth-child(4){width:91%}.audit-doc-paper i:nth-child(5){width:54%}.audit-doc b{display:block;font-size:10px;margin-top:9px}.audit-doc small{display:block;color:#a99fad;font-size:8px;margin-top:3px;letter-spacing:.07em}
.audit-cover-footer{text-align:center;padding:0 0 45px;color:#777080;font-size:10px;letter-spacing:.08em}
@media(max-width:1080px){.audit-cover-hero{grid-template-columns:1fr;gap:42px}.audit-intel-card{max-width:680px;transform:none}.audit-cover-cards{grid-template-columns:1fr}.audit-cover-summary{grid-template-columns:1fr}.audit-cover-nav{gap:22px}}
@media(max-width:720px){.audit-cover-shell{width:min(100% - 26px,1480px)}.audit-cover-header{height:auto;min-height:78px;padding:13px 0;align-items:flex-start}.audit-cover-brand{gap:11px}.audit-cover-divider,.audit-cover-intel{display:none}.audit-cover-brandname{font-size:15px}.audit-cover-nav{gap:10px;flex-wrap:wrap;justify-content:flex-end}.audit-cover-nav button,.audit-cover-nav-link{font-size:10px;padding:8px 3px}.audit-cover-hero{padding:48px 0}.audit-cover-copy h1{font-size:44px}.audit-cover-subtitle{font-size:23px}.audit-cover-lede{font-size:14px}.audit-cover-actions{display:grid;grid-template-columns:1fr}.audit-cover-primary,.audit-cover-secondary{width:100%;justify-content:space-between}.audit-intel-main{grid-template-columns:1fr}.audit-ring{width:160px;height:160px}.audit-intel-bottom{grid-template-columns:1fr}.audit-cover-metrics{grid-template-columns:repeat(2,1fr)}.audit-cover-metric:nth-child(2){border-right:0}.audit-cover-metric:nth-child(-n+2){border-bottom:1px solid #36303e}.audit-evidence-previews{grid-template-columns:1fr}.audit-cover-summary{padding:24px}.audit-cover-summary h2{font-size:30px}}
@media(max-width:440px){.audit-cover-nav button:nth-child(3),.audit-cover-nav-link{display:none}.audit-cover-copy h1{font-size:38px}.audit-cover-eyebrow{font-size:9px}.audit-intel-card{padding:13px}.audit-intel-main{padding:16px}.audit-cover-card{padding:21px}.audit-cover-metric{padding:17px 8px}.audit-cover-metric span{font-size:11px}}
/* ===== END ZEVO AUDIT LANDING ===== */
'@

$landing = @"
<!-- ZEVO_AUDIT_LANDING_START -->
<section class="audit-landing" id="audit-landing" aria-label="ZEVO Corp Audit landing page">
  <div class="audit-cover-shell">
    <header class="audit-cover-header">
      <div class="audit-cover-brand" aria-label="FELTUS LABS Audit Intelligence">
        <span class="audit-cover-brandmark" aria-hidden="true"><i></i><i></i></span>
        <span class="audit-cover-brandname">FELTUS LABS</span>
        <span class="audit-cover-divider" aria-hidden="true"></span>
        <span class="audit-cover-intel">AUDIT INTELLIGENCE</span>
      </div>
      <nav class="audit-cover-nav" aria-label="Landing navigation">
        <button type="button" data-enter-audit="overview">Overview</button>
        <button type="button" data-enter-audit="record-findings">Findings</button>
        <button type="button" data-enter-audit="evidence">Evidence</button>
        $contactNav
      </nav>
    </header>

    <section class="audit-cover-hero">
      <div class="audit-cover-copy">
        <div class="audit-cover-eyebrow">INDEPENDENT AUDIT REVIEW</div>
        <h1>ZEVO CORP AUDIT</h1>
        <div class="audit-cover-subtitle">An audit conducted by Kym Feltus</div>
        <p class="audit-cover-lede">A structured review of business process controls, tax handling, financial risk, operational gaps, and evidence-backed findings for Zevo Corp.</p>
        <div class="audit-cover-credit"><span class="audit-cover-credit-icon">⚗</span><span>Prepared by Kym Feltus&nbsp;&nbsp;•&nbsp;&nbsp;FELTUS LABS</span></div>
        <div class="audit-cover-actions">
          <button class="audit-cover-primary" type="button" data-enter-audit="overview"><span>View Audit Findings</span><span aria-hidden="true">→</span></button>
          <button class="audit-cover-secondary" type="button" data-enter-audit="evidence"><span aria-hidden="true">▱</span><span>Open Evidence</span></button>
        </div>
      </div>

      <aside class="audit-intel-card" aria-label="Audit intelligence summary">
        <div class="audit-intel-head"><div class="audit-intel-title"><span class="audit-layer-icon">◇</span><span>Audit Intelligence</span></div><span class="audit-corp-pill">ZEVO CORP</span></div>
        <div class="audit-intel-main">
          <div class="audit-ring"><div class="audit-ring-inner"><small>AUDIT<br/>COVERAGE</small><strong>100%</strong></div></div>
          <div class="audit-checklist">
            <div class="audit-check"><i>✓</i><span>Process Controls</span></div>
            <div class="audit-check"><i>✓</i><span>Tax Handling</span></div>
            <div class="audit-check"><i>✓</i><span>Financial Risk</span></div>
            <div class="audit-check"><i>✓</i><span>Operational Gaps</span></div>
            <div class="audit-check"><i>✓</i><span>Evidence Review</span></div>
          </div>
        </div>
        <div class="audit-intel-bottom">
          <div class="audit-bars" aria-label="Audit signal chart"><i></i><i></i><i></i><i></i><i></i><i></i></div>
          <div class="audit-risk-signal"><small>OVERALL RISK SIGNAL</small><div class="audit-risk-row"><span class="audit-warning">△</span><strong>Elevated</strong></div><div class="audit-risk-meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div></div>
        </div>
      </aside>
    </section>

    <section class="audit-cover-section" aria-label="Audit focus areas">
      <div class="audit-cover-cards">
        <article class="audit-cover-card"><div class="audit-cover-card-icon">▤</div><h2>Tax &amp; Billing Controls</h2><p>Rate presentation, receipt logic, and transaction handling reviewed.</p></article>
        <article class="audit-cover-card"><div class="audit-cover-card-icon">▥</div><h2>Financial Reporting Risk</h2><p>Findings tied to potential downstream accounting and reporting exposure.</p></article>
        <article class="audit-cover-card"><div class="audit-cover-card-icon">♢</div><h2>Operational &amp;<br/>Governance Gaps</h2><p>Process weaknesses, oversight concerns, and litigation risk indicators.</p></article>
      </div>
      <div class="audit-cover-metrics" aria-label="Audit attributes">
        <div class="audit-cover-metric"><strong>3</strong><span>Core Questions</span></div>
        <div class="audit-cover-metric"><span class="audit-metric-icon">✓</span><span>Evidence-Backed</span></div>
        <div class="audit-cover-metric"><span class="audit-metric-icon">◇</span><span>Control Review</span></div>
        <div class="audit-cover-metric"><span class="audit-metric-icon">△</span><span>Risk Assessment</span></div>
      </div>
    </section>

    <section class="audit-cover-summary" id="audit-summary">
      <div class="audit-cover-summary-copy">
        <h2>Audit Summary</h2>
        <p>A comprehensive, evidence-based audit of Zevo Corp examining business process controls, tax handling, financial risk, and operational governance. The review identifies key control gaps, potential reporting exposure, and areas requiring remediation.</p>
      </div>
      <div>
        <div class="audit-evidence-head"><span>▧</span><span>EVIDENCE PREVIEW</span></div>
        <div class="audit-evidence-previews">
          <button class="audit-doc" type="button" data-enter-audit="evidence"><span class="audit-doc-paper"><i></i><i></i><i></i><i></i></span><b>Billing &amp; Rate Review</b><small>EVIDENCE RECORD</small></button>
          <button class="audit-doc" type="button" data-enter-audit="evidence"><span class="audit-doc-paper"><i></i><i></i><i></i><i></i></span><b>Financial Analysis</b><small>EVIDENCE RECORD</small></button>
          <button class="audit-doc" type="button" data-enter-audit="evidence"><span class="audit-doc-paper"><i></i><i></i><i></i><i></i></span><b>Process &amp; Controls</b><small>EVIDENCE RECORD</small></button>
        </div>
      </div>
    </section>
    <footer class="audit-cover-footer">INDEPENDENT AUDIT REVIEW • PREPARED BY KYM FELTUS • FELTUS LABS</footer>
  </div>
</section>
<!-- ZEVO_AUDIT_LANDING_END -->
"@

$js = @'
<script id="zevo-audit-landing-controller">
(function(){
  const landing=document.getElementById('audit-landing');
  const app=document.querySelector('.app');
  if(!landing||!app)return;
  function syncCover(){
    const view=(location.hash||'').replace('#','').trim();
    const showCover=!view||view==='landing';
    landing.hidden=!showCover;
    app.classList.toggle('audit-app-hidden',showCover);
    document.body.classList.toggle('audit-landing-open',showCover);
    if(showCover){window.scrollTo(0,0);}
  }
  document.querySelectorAll('[data-enter-audit]').forEach(el=>{
    el.addEventListener('click',()=>{
      const view=el.dataset.enterAudit||'overview';
      if(location.hash==='#'+view){
        landing.hidden=true;
        app.classList.remove('audit-app-hidden');
        document.body.classList.remove('audit-landing-open');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        window.scrollTo(0,0);
      }else{
        location.hash=view;
      }
    });
  });
  window.addEventListener('hashchange',syncCover);
  syncCover();
})();
</script>
'@

# Insert CSS before the first closing style tag.
$styleIndex = $html.IndexOf('</style>')
$html = $html.Insert($styleIndex, $css)

# Insert landing markup immediately after body opens.
$bodyIndex = $html.IndexOf('<body>') + '<body>'.Length
$html = $html.Insert($bodyIndex, "`r`n$landing`r`n")

# Prevent the existing audit workspace from flashing before the cover controller runs.
$html = $html.Replace('<div class="app">', '<div class="app audit-app-hidden">')

# Insert controller before body closes.
$bodyCloseIndex = $html.LastIndexOf('</body>')
$html = $html.Insert($bodyCloseIndex, "`r`n$js`r`n")

Set-Content -LiteralPath $indexPath -Value $html -Encoding UTF8

Write-Host "ZEVO audit landing page installed successfully." -ForegroundColor Green
Write-Host "Updated: $indexPath"
Write-Host "Backup:  $backupPath"
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "  git -C `"$ProjectPath`" add index.html"
Write-Host "  git -C `"$ProjectPath`" commit -m `"Add ZEVO audit landing page`""
Write-Host "  git -C `"$ProjectPath`" push"
