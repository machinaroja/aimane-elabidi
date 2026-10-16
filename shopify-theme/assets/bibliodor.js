/*
  BIBLIODOR — comportements du thème.
  Tout fonctionne sans JavaScript (formulaires classiques) ; ce script
  améliore l'expérience : ajout au panier sans recharger, compteur à jour,
  tri du catalogue appliqué dès la sélection.
*/
(() => {
  const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  const status = document.getElementById('cart-status');
  const t = window.BIBLIODOR_STRINGS || {};

  const announce = (message) => {
    if (status) status.textContent = message;
  };

  const renderCount = (count) => {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  };

  const markInCart = (variantIds) => {
    document.querySelectorAll('[data-add-to-cart-form]').forEach((form) => {
      const id = Number(form.querySelector('input[name="id"]')?.value);
      const button = form.querySelector('[data-add-to-cart]');
      if (!button || !variantIds.has(id)) return;
      button.dataset.inCart = 'true';
      button.classList.add('is-added');
      const label = button.querySelector('[data-label]');
      if (label) label.textContent = t.viewCart || 'Voir le panier';
    });
  };

  const fetchCart = () =>
    fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } }).then((r) => {
      if (!r.ok) throw new Error('cart');
      return r.json();
    });

  // État initial : boutons des livres déjà au panier
  if (document.querySelector('[data-add-to-cart-form]')) {
    fetchCart()
      .then((cart) => markInCart(new Set(cart.items.map((i) => i.variant_id))))
      .catch(() => {});
  }

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-add-to-cart-form]');
    if (!form) return;
    event.preventDefault();

    const button = form.querySelector('[data-add-to-cart]');
    const error = form.querySelector('[data-form-error]');

    // Un ebook ne s'achète qu'une fois : s'il est déjà au panier, on y va.
    if (button?.dataset.inCart === 'true') {
      window.location.href = `${root}cart`;
      return;
    }

    if (error) error.hidden = true;
    button?.setAttribute('aria-busy', 'true');
    if (button) button.disabled = true;

    try {
      const id = Number(form.querySelector('input[name="id"]').value);
      const response = await fetch(`${root}cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id, quantity: 1 }] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.description || data.message || '');

      const cart = await fetchCart();
      renderCount(cart.item_count);
      markInCart(new Set(cart.items.map((i) => i.variant_id)));
      announce(t.added || 'Ajouté au panier.');
    } catch (err) {
      const message = (err && err.message) || t.addError || "L'ajout au panier a échoué. Réessayez dans un instant.";
      if (error) {
        error.textContent = message;
        error.hidden = false;
      }
      announce(message);
    } finally {
      button?.removeAttribute('aria-busy');
      if (button) button.disabled = false;
    }
  });

  // Tri du catalogue : on applique dès le choix (le bouton reste disponible sans JS)
  document.querySelectorAll('[data-autosubmit]').forEach((select) => {
    const submit = select.form?.querySelector('[data-autosubmit-button]');
    if (submit) submit.hidden = true;
    select.addEventListener('change', () => select.form.submit());
  });
})();
