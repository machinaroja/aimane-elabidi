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
      document.querySelectorAll('[data-cart-count]').forEach((el) => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); });
      if (window.BIBLIODOR_TOAST) window.BIBLIODOR_TOAST(cart, id);
      if (window.BIBLIODOR_MINICART) window.BIBLIODOR_MINICART(cart);
    } catch (err) {
      const message = (err && err.message) || t.addError || "L'ajout au panier a échoué. Réessaie dans un instant.";
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


/* ---------- Couche dynamique v3 ---------- */
(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
  };

  // Apparition douce des blocs au défilement
  if (!reduce && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');
    const targets = document.querySelectorAll('main .section, main .section-head, .book-grid > li, .apercu__pages li, .product-details > *, .newsletter__inner > *, .how-step, .rayon');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    targets.forEach((el, i) => {
      if (el.closest('.product-hero') || el.closest('.hero')) return;
      el.classList.add('reveal');
      if (el.matches('.book-grid > li, .apercu__pages li')) el.style.setProperty('--d', `${(i % 4) * 0.08}s`);
      io.observe(el);
    });
  }

  // Pastille d'offre flottante
  const pill = document.querySelector('[data-offer-pill]');
  if (pill && store.get('bd_pill_closed') !== '1') {
    const show = () => pill.classList.add('is-shown');
    let shown = false;
    const onScroll = () => { if (!shown && window.scrollY > 420) { shown = true; show(); window.removeEventListener('scroll', onScroll); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    setTimeout(() => { if (!shown) { shown = true; show(); } }, 9000);
    pill.querySelector('[data-offer-pill-close]')?.addEventListener('click', () => {
      pill.classList.remove('is-shown'); store.set('bd_pill_closed', '1');
    });
  }

  // Toast après un ajout au panier : progression vers l'offre 2+1
  const toast = document.querySelector('[data-cart-toast]');
  let timer;
  window.BIBLIODOR_TOAST = (cart, addedId) => {
    if (!toast) return;
    const item = cart.items.find((i) => i.variant_id === addedId);
    const ebooks = cart.items.filter((i) => (i.product_type || '').toLowerCase() === 'ebook').reduce((n, i) => n + i.quantity, 0);
    const isPack = item && (item.product_type || '').toLowerCase() === 'pack';
    const title = toast.querySelector('[data-toast-title]');
    const text = toast.querySelector('[data-toast-text]');
    const bar = toast.querySelector('[data-toast-bar]');
    title.textContent = item ? `« ${item.product_title.replace(/^N°\d+\s*—\s*/, '')} » est dans ton panier` : 'Ajouté au panier';
    let pct = 100;
    if (isPack) { text.textContent = 'Tes 4 ebooks t’attendent : 29,70 € d’économie.'; }
    else if (ebooks % 3 === 1) { text.textContent = 'Encore 2 ebooks et le 3ᵉ est offert.'; pct = 33; }
    else if (ebooks % 3 === 2) { text.textContent = 'Plus qu’un ebook : le prochain t’est offert !'; pct = 66; }
    else { text.textContent = 'Bravo : ton 3ᵉ ebook est offert, la remise est appliquée.'; pct = 100; }
    bar.style.width = '0';
    toast.hidden = false;
    requestAnimationFrame(() => { toast.classList.add('is-shown'); requestAnimationFrame(() => { bar.style.width = `${pct}%`; }); });
    clearTimeout(timer);
    timer = setTimeout(() => toast.classList.remove('is-shown'), 6500);
  };
  // Mini-panier flottant : toujours visible dès qu'il y a un article
  const mini = document.querySelector('[data-mini-cart]');
  const fmt = (cents) => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  window.BIBLIODOR_MINICART = (cart) => {
    if (!mini) return;
    const ebooks = cart.items.filter((i) => (i.product_type || '').toLowerCase() === 'ebook').reduce((n, i) => n + i.quantity, 0);
    const r = ebooks % 3;
    const hint = mini.querySelector('[data-mini-cart-hint]');
    if (hint) hint.textContent = ebooks === 0 ? 'Ton panier t’attend' : r === 1 ? 'Encore 2 ebooks et le 3ᵉ est offert' : r === 2 ? 'Plus qu’un ebook pour le 3ᵉ offert' : 'Ton 3ᵉ ebook est offert ✓';
    const total = mini.querySelector('.mini-cart__total');
    if (total) total.textContent = fmt(cart.total_price);
    mini.hidden = cart.item_count === 0;
    if (!mini.hidden) { mini.classList.remove('pop'); void mini.offsetWidth; mini.classList.add('pop'); }
    document.body.classList.toggle('has-mini-cart', !mini.hidden);
  };
  if (mini && !mini.hidden) document.body.classList.add('has-mini-cart');

  toast?.addEventListener('mouseenter', () => clearTimeout(timer));
  toast?.addEventListener('mouseleave', () => { timer = setTimeout(() => toast.classList.remove('is-shown'), 2500); });
})();
