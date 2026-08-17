// Dictionnaire de tes assets
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

// 1. Récupération robuste du HTML avec cascade de proxys et timeout
async function fetchMarmitonHtml(targetUrl) {
  const proxies = [
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
  ];

  for (const proxy of proxies) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 secondes max par proxy

      const res = await fetch(proxy, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) continue;

      if (proxy.includes("allorigins")) {
        const json = await res.json();
        if (json.contents) return json.contents;
      } else {
        const text = await res.text();
        if (text && text.length > 500) return text;
      }
    } catch (e) {
      console.warn("Échec du proxy :", proxy);
    }
  }

  throw new Error("Impossible de récupérer la page (proxies bloqués par Marmiton ou lien invalide).");
}

// 2. Extraction récursive de l'objet Recipe
function extractRecipeData(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

  for (const s of scripts) {
    try {
      const data = JSON.parse(s.textContent);

      // Cas 1 : Objet Recipe direct
      if (data["@type"] === "Recipe") return data;

      // Cas 2 : Tableau d'objets
      if (Array.isArray(data)) {
        const found = data.find(item => item["@type"] === "Recipe");
        if (found) return found;
      }

      // Cas 3 : Objet structuré avec @graph (le standard Marmiton actuel)
      if (data["@graph"] && Array.isArray(data["@graph"])) {
        const found = data["@graph"].find(item => item["@type"] === "Recipe");
        if (found) return found;
      }
    } catch (e) {}
  }
  return null;
}

// 3. Fonction principale déclenchée au clic
async function chargerRecette() {
  const inputUrl = document.getElementById("recipeUrl").value.trim();
  const nbPersonnes = parseInt(document.getElementById("nbPersonnes").value) || 2;
  const zoneResultat = document.getElementById("resultat");

  if (!inputUrl) {
    alert("Veuillez renseigner une URL Marmiton valide.");
    return;
  }

  zoneResultat.innerHTML = "<p>⏳ Récupération et parsing de la recette en cours...</p>";

  try {
    const html = await fetchMarmitonHtml(inputUrl);
    const recipe = extractRecipeData(html);

    if (!recipe) {
      throw new Error("Aucune donnée de recette structurée trouvée sur cette page.");
    }

    // Calcul du ratio pour les quantités
    const baseYield = parseInt(recipe.recipeYield) || 4;
    const ratio = nbPersonnes / baseYield;

    // Rendu des ingrédients
    let htmlContent = `
      <div class="card">
        <h2>${recipe.name} (${nbPersonnes} pers.)</h2>
        <h3>Ingrédients :</h3>
    `;

    const ingredientsList = recipe.recipeIngredient || [];
    ingredientsList.forEach(ing => {
      const lower = ing.toLowerCase();

      // Détection de l'icône correspondante
      let icon = null;
      for (const [key, file] of Object.entries(ASSET_MAP.ingredients)) {
        if (lower.includes(key)) {
          icon = file;
          break;
        }
      }

      // Ajustement des nombres / doses
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

    htmlContent += `</div><div class="card"><h3>Étapes de préparation :</h3>`;

    // Rendu des étapes et animations
    let steps = [];
    if (Array.isArray(recipe.recipeInstructions)) {
      steps = recipe.recipeInstructions;
    } else if (recipe.recipeInstructions) {
      steps = [recipe.recipeInstructions];
    }

    steps.forEach((step, i) => {
      const stepText = typeof step === 'string' ? step : (step.text || "");
      const lower = stepText.toLowerCase();

      // Détection de l'animation Lottie
      let anim = null;
      for (const [key, file] of Object.entries(ASSET_MAP.actions)) {
        if (lower.includes(key)) {
          anim = file;
          break;
        }
      }

      htmlContent += `
        <div style="margin-bottom: 25px;">
          <p><strong>Étape ${i + 1} :</strong> ${stepText}</p>
          ${anim ? `<dotlottie-player src="assets/${anim}" background="transparent" speed="1" style="width: 130px; height: 130px;" loop autoplay></dotlottie-player>` : ''}
        </div>
      `;
    });

    htmlContent += `</div>`;
    zoneResultat.innerHTML = htmlContent;

  } catch (err) {
    zoneResultat.innerHTML = `
      <div class="card" style="border-left: 4px solid #ef4444;">
        <p style="color: #b91c1c; font-weight: bold;">Erreur lors du chargement :</p>
        <p style="color: #7f1d1d;">${err.message}</p>
      </div>
    `;
  }
}
