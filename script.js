// ==========================================================================
// Vanilla JavaScript Application Logic
// ==========================================================================

const API_BASE = "https://www.themealdb.com/api/json/v1/1";
const STORAGE_KEY = "gourmet_favorites_v1";

// --- Application State ---
const state = {
  query: "",
  category: "all",
  recipes: [],
  currentPage: 1,
  pageSize: 8,
  favorites: [],
  loading: false,
  error: null,
  selectedRecipe: null
};

// --- DOM Elements ---
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const categoryPills = document.getElementById("categoryPills");
const resultsGrid = document.getElementById("resultsGrid");
const statusMessage = document.getElementById("statusMessage");
const resultsTitle = document.getElementById("resultsTitle");
const resultsCount = document.getElementById("resultsCount");
const paginationContainer = document.getElementById("paginationContainer");
const paginationControls = document.getElementById("paginationControls");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const recipeModal = document.getElementById("recipeModal");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalContent = document.getElementById("modalContent");
const favoritesToggleBtn = document.getElementById("favoritesToggleBtn");
const favoritesDrawer = document.getElementById("favoritesDrawer");
const drawerCloseBtn = document.getElementById("drawerCloseBtn");
const favoritesList = document.getElementById("favoritesList");
const favCountBadge = document.getElementById("favCountBadge");

// SVG Icon Template for Star Logo
const STAR_LOGO_SVG = (active) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${active ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2l2.9 6.8 7.1.6-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7-5.4-4.8 7.1-.6z"/>
  </svg>
`;

// --- Helper Utilities ---
function debounce(func, delay = 350) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
}

function loadFavorites() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    state.favorites = data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Failed to load favorites from localStorage:", err);
    state.favorites = [];
  }
  updateFavoritesUI();
}

function saveFavorites() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.favorites));
  } catch (err) {
    console.error("Failed to save favorites to localStorage:", err);
  }
  updateFavoritesUI();
}

function isFavorite(idMeal) {
  return state.favorites.some(fav => fav.idMeal === idMeal);
}

function toggleFavorite(recipe) {
  if (isFavorite(recipe.idMeal)) {
    state.favorites = state.favorites.filter(fav => fav.idMeal !== recipe.idMeal);
  } else {
    state.favorites.push({
      idMeal: recipe.idMeal,
      strMeal: recipe.strMeal,
      strMealThumb: recipe.strMealThumb,
      strCategory: recipe.strCategory || "Recipe"
    });
  }
  saveFavorites();
  renderGrid();
  if (state.selectedRecipe && state.selectedRecipe.idMeal === recipe.idMeal) {
    updateModalFavoriteBtn();
  }
}

function updateFavoritesUI() {
  favCountBadge.textContent = state.favorites.length;
  renderFavoritesDrawer();
}

// --- API Data Fetching ---
async function fetchRecipes() {
  state.loading = true;
  state.error = null;
  renderState();

  try {
    let url = "";
    if (state.category !== "all") {
      url = `${API_BASE}/filter.php?c=${encodeURIComponent(state.category)}`;
    } else if (state.query.trim()) {
      url = `${API_BASE}/search.php?s=${encodeURIComponent(state.query.trim())}`;
    } else {
      url = `${API_BASE}/search.php?s=chicken`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    let meals = data.meals || [];

    if (state.category !== "all" && state.query.trim() && meals.length > 0) {
      const q = state.query.trim().toLowerCase();
      meals = meals.filter(m => m.strMeal.toLowerCase().includes(q));
    }

    state.recipes = meals;
    state.currentPage = 1;
  } catch (err) {
    console.error("Error fetching recipes:", err);
    state.error = "Unable to fetch recipes right now. Please check your internet connection and try again.";
    state.recipes = [];
  } finally {
    state.loading = false;
    renderState();
  }
}

async function fetchRecipeDetail(idMeal) {
  try {
    const res = await fetch(`${API_BASE}/lookup.php?i=${idMeal}`);
    if (!res.ok) throw new Error("Failed to fetch recipe detail");
    const data = await res.json();
    return data.meals ? data.meals[0] : null;
  } catch (err) {
    console.error("Error fetching detail:", err);
    return null;
  }
}

// --- Render Logic ---
function renderState() {
  if (state.query.length > 0) {
    clearSearchBtn.classList.remove("hidden");
  } else {
    clearSearchBtn.classList.add("hidden");
  }

  if (state.category !== "all") {
    resultsTitle.textContent = `${state.category} Recipes`;
  } else if (state.query.trim()) {
    resultsTitle.textContent = `Search results for "${state.query.trim()}"`;
  } else {
    resultsTitle.textContent = "Featured Recipes";
  }

  if (state.loading) {
    statusMessage.classList.add("hidden");
    paginationContainer.classList.add("hidden");
    resultsCount.textContent = "Loading...";
    renderSkeletons();
    return;
  }

  if (state.error) {
    resultsGrid.innerHTML = "";
    paginationContainer.classList.add("hidden");
    resultsCount.textContent = "";
    statusMessage.className = "status-container";
    statusMessage.innerHTML = `
      <div class="status-icon error">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <h3 class="status-title">Connection Error</h3>
      <p class="status-desc">${state.error}</p>
      <button class="btn btn-primary" onclick="fetchRecipes()">Retry Request</button>
    `;
    return;
  }

  if (state.recipes.length === 0) {
    resultsGrid.innerHTML = "";
    paginationContainer.classList.add("hidden");
    resultsCount.textContent = "0 recipes found";
    statusMessage.className = "status-container";
    statusMessage.innerHTML = `
      <div class="status-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
      <h3 class="status-title">No Recipes Found</h3>
      <p class="status-desc">We couldn't find any recipes matching your current filter. Try searching for something else like "Chicken", "Pasta", or "Cake".</p>
    `;
    return;
  }

  statusMessage.classList.add("hidden");
  renderGrid();
  renderPagination();
}

function renderSkeletons() {
  resultsGrid.innerHTML = Array(state.pageSize)
    .fill(0)
    .map(
      () => `
      <div class="skeleton-card">
        <div class="skeleton-img"></div>
        <div class="skeleton-text long"></div>
        <div class="skeleton-text short"></div>
      </div>
    `
    )
    .join("");
}

function renderGrid() {
  const total = state.recipes.length;
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, total);
  const pagedRecipes = state.recipes.slice(startIndex, endIndex);

  resultsCount.textContent = `Showing ${startIndex + 1}–${endIndex} of ${total} recipes`;

  resultsGrid.innerHTML = pagedRecipes
    .map(recipe => {
      const fav = isFavorite(recipe.idMeal);
      return `
        <article class="card" data-id="${recipe.idMeal}">
          <div class="card-media">
            <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" loading="lazy" />
            <button class="card-fav-btn ${fav ? "active" : ""}" data-action="favorite" data-id="${recipe.idMeal}" title="${fav ? "Remove from favorites" : "Add to favorites"}">
              ${STAR_LOGO_SVG(fav)}
            </button>
          </div>
          <div class="card-content">
            <div class="card-tags">
              <span class="tag">${recipe.strCategory || state.category || "Recipe"}</span>
              ${recipe.strArea ? `<span class="tag">${recipe.strArea}</span>` : ""}
            </div>
            <h3 class="card-title">${recipe.strMeal}</h3>
            <div class="card-meta">
              <span>View details & instructions</span>
              <button class="card-action-btn" data-action="view" data-id="${recipe.idMeal}">
                View &rarr;
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPagination() {
  const totalPages = Math.ceil(state.recipes.length / state.pageSize);
  if (totalPages <= 1) {
    paginationContainer.classList.add("hidden");
    return;
  }

  paginationContainer.classList.remove("hidden");
  let html = `
    <button class="page-btn" ${state.currentPage === 1 ? "disabled" : ""} data-page="${state.currentPage - 1}">&larr; Prev</button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <button class="page-btn ${state.currentPage === i ? "active" : ""}" data-page="${i}">${i}</button>
    `;
  }

  html += `
    <button class="page-btn" ${state.currentPage === totalPages ? "disabled" : ""} data-page="${state.currentPage + 1}">Next &rarr;</button>
  `;

  paginationControls.innerHTML = html;
}

// --- Modal Detail View ---
async function openRecipeModal(idMeal) {
  modalContent.innerHTML = `
    <div style="padding: 60px; text-align: center; color: var(--text-muted);">
      <p>Loading full recipe details...</p>
    </div>
  `;
  recipeModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  const recipe = await fetchRecipeDetail(idMeal);
  if (!recipe) {
    modalContent.innerHTML = `
      <div style="padding: 40px; text-align: center;">
        <p>Failed to load details for this recipe.</p>
      </div>
    `;
    return;
  }

  state.selectedRecipe = recipe;
  const fav = isFavorite(recipe.idMeal);

  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ing = recipe[`strIngredient${i}`];
    const measure = recipe[`strMeasure${i}`];
    if (ing && ing.trim()) {
      ingredients.push({ ingredient: ing.trim(), measure: measure ? measure.trim() : "" });
    }
  }

  let youtubeEmbed = "";
  if (recipe.strYoutube) {
    const videoId = recipe.strYoutube.split("v=")[1];
    if (videoId) {
      const cleanId = videoId.split("&")[0];
      youtubeEmbed = `https://www.youtube.com/embed/${cleanId}`;
    }
  }

  modalContent.innerHTML = `
    <div class="modal-hero">
      <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" />
      <div class="modal-hero-overlay">
        <div class="modal-hero-title">
          <h2>${recipe.strMeal}</h2>
          <div class="modal-hero-badges">
            <span class="tag">${recipe.strCategory || "Recipe"}</span>
            ${recipe.strArea ? `<span class="tag">${recipe.strArea}</span>` : ""}
          </div>
        </div>
        <button id="modalFavBtn" class="btn ${fav ? "btn-fav active" : "btn-primary"}" style="z-index: 5;">
          ${STAR_LOGO_SVG(fav)}
          ${fav ? "Saved in Favorites" : "Add to Favorites"}
        </button>
      </div>
    </div>

    <div class="modal-body-padding">
      <div class="modal-grid">
        <div class="ingredients-box">
          <h3>Ingredients (${ingredients.length})</h3>
          <ul class="ingredient-list">
            ${ingredients
              .map(
                item => `
              <li class="ingredient-item">
                <span class="ingredient-name">${item.ingredient}</span>
                <span class="ingredient-measure">${item.measure}</span>
              </li>
            `
              )
              .join("")}
          </ul>
        </div>

        <div class="instructions-box">
          <h3>Preparation Instructions</h3>
          <p class="instructions-text">${recipe.strInstructions || "No detailed instructions provided."}</p>
        </div>
      </div>

      ${
        youtubeEmbed
          ? `
        <div class="video-box">
          <h3>Video Tutorial</h3>
          <div class="video-container">
            <iframe src="${youtubeEmbed}" title="${recipe.strMeal} Video Tutorial" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  document.getElementById("modalFavBtn").addEventListener("click", () => {
    toggleFavorite(recipe);
  });
}

function updateModalFavoriteBtn() {
  const modalFavBtn = document.getElementById("modalFavBtn");
  if (!modalFavBtn || !state.selectedRecipe) return;

  const fav = isFavorite(state.selectedRecipe.idMeal);
  modalFavBtn.className = `btn ${fav ? "btn-fav active" : "btn-primary"}`;
  modalFavBtn.innerHTML = `
    ${STAR_LOGO_SVG(fav)}
    ${fav ? "Saved in Favorites" : "Add to Favorites"}
  `;
}

function closeModal() {
  recipeModal.classList.add("hidden");
  document.body.style.overflow = "";
  state.selectedRecipe = null;
}

// --- Favorites Drawer ---
function renderFavoritesDrawer() {
  if (state.favorites.length === 0) {
    favoritesList.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
        <p>No saved recipes yet.</p>
        <p style="font-size: 12px; margin-top: 6px;">Click the star logo icon on any recipe to bookmark it here!</p>
      </div>
    `;
    return;
  }

  favoritesList.innerHTML = state.favorites
    .map(
      item => `
    <div class="fav-item" data-id="${item.idMeal}">
      <img src="${item.strMealThumb}" alt="${item.strMeal}" />
      <div class="fav-item-info">
        <div class="fav-item-title">${item.strMeal}</div>
        <div class="fav-item-category">${item.strCategory}</div>
      </div>
      <button class="btn-icon" data-action="remove-fav" data-id="${item.idMeal}" title="Remove favorite">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `
    )
    .join("");
}

// --- Event Listeners ---
const handleSearchInput = debounce(e => {
  state.query = e.target.value;
  state.currentPage = 1;
  fetchRecipes();
}, 350);

searchInput.addEventListener("input", handleSearchInput);

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  state.query = "";
  state.currentPage = 1;
  fetchRecipes();
});

categoryPills.addEventListener("click", e => {
  if (e.target.classList.contains("pill")) {
    document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    e.target.classList.add("active");

    state.category = e.target.getAttribute("data-category");
    state.currentPage = 1;
    fetchRecipes();
  }
});

resultsGrid.addEventListener("click", e => {
  const favBtn = e.target.closest("[data-action='favorite']");
  if (favBtn) {
    const idMeal = favBtn.getAttribute("data-id");
    const recipe = state.recipes.find(r => r.idMeal === idMeal);
    if (recipe) toggleFavorite(recipe);
    return;
  }

  const card = e.target.closest(".card");
  if (card) {
    const idMeal = card.getAttribute("data-id");
    openRecipeModal(idMeal);
  }
});

paginationControls.addEventListener("click", e => {
  const btn = e.target.closest(".page-btn");
  if (btn && !btn.disabled) {
    const page = parseInt(btn.getAttribute("data-page"), 10);
    if (!isNaN(page)) {
      state.currentPage = page;
      renderGrid();
      renderPagination();
      window.scrollTo({ top: 300, behavior: "smooth" });
    }
  }
});

pageSizeSelect.addEventListener("change", e => {
  state.pageSize = parseInt(e.target.value, 10);
  state.currentPage = 1;
  renderGrid();
  renderPagination();
});

// Modal Events
modalCloseBtn.addEventListener("click", closeModal);
recipeModal.addEventListener("click", e => {
  if (e.target === recipeModal) closeModal();
});

// Drawer Events
favoritesToggleBtn.addEventListener("click", () => {
  favoritesDrawer.classList.remove("hidden");
});
drawerCloseBtn.addEventListener("click", () => {
  favoritesDrawer.classList.add("hidden");
});
favoritesDrawer.addEventListener("click", e => {
  if (e.target === favoritesDrawer) favoritesDrawer.classList.add("hidden");
});

favoritesList.addEventListener("click", e => {
  const removeBtn = e.target.closest("[data-action='remove-fav']");
  if (removeBtn) {
    e.stopPropagation();
    const idMeal = removeBtn.getAttribute("data-id");
    state.favorites = state.favorites.filter(f => f.idMeal !== idMeal);
    saveFavorites();
    renderGrid();
    return;
  }

  const favItem = e.target.closest(".fav-item");
  if (favItem) {
    const idMeal = favItem.getAttribute("data-id");
    favoritesDrawer.classList.add("hidden");
    openRecipeModal(idMeal);
  }
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeModal();
    favoritesDrawer.classList.add("hidden");
  }
});

// --- Initialize App ---
loadFavorites();
fetchRecipes();