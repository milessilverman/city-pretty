FILE_PATH = "/Users/milessilverman/.gemini/antigravity/scratch/city-pretty-pipeline/index.html"

with open(FILE_PATH, "r", encoding="utf-8") as f:
    content = f.read()

OLD_PROGRESS_FUNCS = '''function startProgress(initialPct = 25) {
  const bar = document.getElementById("top-progress");
  if (!bar) return;
  bar.style.opacity = "1";
  bar.style.width = initialPct + "%";
}
function setProgress(pct) {
  const bar = document.getElementById("top-progress");
  if (!bar) return;
  bar.style.opacity = "1";
  bar.style.width = pct + "%";
}
function doneProgress() {
  const bar = document.getElementById("top-progress");
  if (!bar) return;
  bar.style.width = "100%";
  setTimeout(() => {
    bar.style.opacity = "0";
    setTimeout(() => { bar.style.width = "0%"; }, 400);
  }, 250);
}'''

NEW_PROGRESS_FUNCS = '''function startProgress(initialPct = 25) {
  const bar = document.getElementById("top-progress");
  if (bar) {
    bar.style.opacity = "1";
    bar.style.width = initialPct + "%";
  }
  const pctEl = document.getElementById("hud-pct");
  if (pctEl) pctEl.textContent = initialPct + "%";
}
function setProgress(pct) {
  const bar = document.getElementById("top-progress");
  if (bar) {
    bar.style.opacity = "1";
    bar.style.width = pct + "%";
  }
  const pctEl = document.getElementById("hud-pct");
  if (pctEl) pctEl.textContent = Math.round(pct) + "%";
}
function doneProgress() {
  const bar = document.getElementById("top-progress");
  const pctEl = document.getElementById("hud-pct");
  if (pctEl) pctEl.textContent = "100%";
  if (bar) {
    bar.style.width = "100%";
    setTimeout(() => {
      bar.style.opacity = "0";
      setTimeout(() => { bar.style.width = "0%"; }, 400);
    }, 250);
  }
}'''

if OLD_PROGRESS_FUNCS in content:
    content = content.replace(OLD_PROGRESS_FUNCS, NEW_PROGRESS_FUNCS, 1)
    print("Upgraded startProgress, setProgress, and doneProgress to synchronize #hud-pct")
else:
    print("WARNING: OLD_PROGRESS_FUNCS not found")

OLD_SCHEDULE_NAT = '''    if (typeof scheduleNatLots === "function") scheduleNatLots();
  } catch (err) {'''

NEW_SCHEDULE_NAT = '''    if (typeof scheduleNatLots === "function") scheduleNatLots();
    if (typeof setProgress === "function") setProgress(100);
    if (typeof setHud === "function") setHud("✓ " + cName + " Ready");
    setTimeout(() => {
      if (typeof doneProgress === "function") doneProgress();
      if (typeof hideHud === "function") hideHud();
    }, 450);
  } catch (err) {'''

if OLD_SCHEDULE_NAT in content:
    content = content.replace(OLD_SCHEDULE_NAT, NEW_SCHEDULE_NAT, 1)
    print("Added smooth HUD & progress bar resolution to openCounty success block")
else:
    print("WARNING: OLD_SCHEDULE_NAT not found")

with open(FILE_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated index.html size:", len(content))
