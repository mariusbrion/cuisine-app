// Dictionnaire de tes assets (vérifie bien l'orthographe exacte de tes fichiers dans /assets)
const ASSET_MAP = {
  ingredients: {
    "ail": "ail.png",
    "amande": "amande.png",
    "aubergine": "aubergine.png",
    "banane": "banane.png",
    "citron": "citron.png",
    "citrouille": "citrouille.png",
    "eau": "eau.png",
    "farine": "farine.png",
    "fraise": "fraise.png",
    "raisin": "grain-de-raisin.png",
    "huile": "huile-olive.png",
    "kiwi": "kiwi.png",
    "lait": "lait.png",
    "oignon": "oignon.png",
    "orange": "orange.png",
    "pasteque": "pasteque.png",
    "poireau": "poireau.png",
    "pomme": "pomme.png"
  },
  actions: {
    "couper": "decouper.json",
    "émincer": "decouper.json",
    "cuire": "poele.json",
    "revenir": "poele.json",
    "mélanger": "touillage.json",
    "remuer": "touillage.json"
  }
};

async function chargerRecette() {
  const url = document.getElementById("recipeUrl").value;
  const nbPersonnes = parseInt(document.getElementById("nbPersonnes").value) || 2;
  const zoneResultat = document.getElementById("resultat");

  if (!url) return alert("Rentre une URL Marmiton !");
  zoneResultat.innerHTML = "<p>Chargement de la recette...</p>";

  try {
    // 1. Scraping via proxy
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    const data = await res.json();

    // 2. Récupération du JSON-LD
    const parser = new DOMParser();
    const doc = parser.parseFromString(data.contents, "text/html");
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

    let recipe = null;
    scripts.forEach(s => {
      try {
        const parsed = JSON.parse(s.textContent);
        if (parsed["@type"] === "Recipe") recipe = parsed;
        if (Array.isArray(parsed)) recipe = parsed.find(item => item["@type"] === "Recipe") || recipe;
      } catch (e) {}
    });

    if (!recipe) throw new Error("Recette introuvable");

    // 3. Calcul du ratio
    const baseYield = parseInt(recipe.recipeYield) || 4;
    const ratio = nbPersonnes / baseYield;

    // 4. Affichage du Titre et Ingrédients
    let htmlContent = `<div class="card"><h2>${recipe.name} (${nbPersonnes} pers.)</h2><h3>Ingrédients :</h3>`;

    recipe.recipeIngredient.forEach(ing => {
      const lower = ing.toLowerCase();
      
      // Match de l'icône
      let icon = null;
      for (const [key, file] of Object.entries(ASSET_MAP.ingredients)) {
        if (lower.includes(key)) { icon = file; break; }
      }

      // Recalcul des quantités
      const scaled = ing.replace(/(\d+([\.,]\d+)?)/g, m => {
        const v = parseFloat(m.replace(',', '.'));
        return (Math.round(v * ratio * 10) / 10).toString().replace('.', ',');
      });

      htmlContent += `
        <div class="ingredient-row">
          ${icon ? `<img src="assets/${icon}" class="icon">` : `<span>•</span>`}
          <span>${scaled}</span>
        </div>
      `;
    });

    htmlContent += `</div><div class="card"><h3>Étapes :</h3>`;

    // 5. Affichage des étapes et animations
    const steps = Array.isArray(recipe.recipeInstructions) ? recipe.recipeInstructions : [recipe.recipeInstructions];
    steps.forEach((step, i) => {
      const stepText = typeof step === 'string' ? step : step.text;
      const lower = stepText.toLowerCase();

      // Match animation
      let anim = null;
      for (const [key, file] of Object.entries(ASSET_MAP.actions)) {
        if (lower.includes(key)) { anim = file; break; }
      }

      htmlContent += `
        <div style="margin-bottom: 20px;">
          <p><strong>Étape ${i + 1} :</strong> ${stepText}</p>
          ${anim ? `<dotlottie-player src="assets/${anim}" background="transparent" speed="1" style="width: 120px; height: 120px;" loop autoplay></dotlottie-player>` : ''}
        </div>
      `;
    });

    htmlContent += `</div>`;
    zoneResultat.innerHTML = htmlContent;

  } catch (err) {
    zoneResultat.innerHTML = `<p style="color:red;">Erreur : ${err.message}</p>`;
  }
}
