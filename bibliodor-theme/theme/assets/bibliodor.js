/*
  BIBLIODOR — comportements du thème.
  Tout fonctionne sans JavaScript (formulaires classiques, lien vers la page panier) ;
  ce script améliore l'expérience : ajout au panier sans recharger, panier latéral
  avec la progression de l'offre « 2 achetés, le 3e offert », tri du catalogue
  appliqué dès la sélection, bandeau d'offres qui alterne.
*/
(() => {
  const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  const t = window.BIBLIODOR_STRINGS || {};
  const status = document.getElementById('cart-status');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const announce = (message) => {
    if (status) status.textContent = message;
  };

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const money = (cents) => {
    const format = t.moneyFormat || '{{amount_with_comma_separator}} €';
    const value = (cents / 100).toFixed(2);
    const comma = value.replace('.', ',');
    const dot = Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 });
    return format
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, comma)
      .replace(/\{\{\s*amount\s*\}\}/, dot)
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/, String(Math.round(cents / 100)))
      .replace(/<[^>]+>/g, '');
  };

  const fetchCart = () =>
    fetch(`${root}cart.js`, { headers: { Accept: 'application/json' } }).then((r) => {
      if (!r.ok) throw new Error('cart');
      return r.json();
    });

  /* ---------- Compteur et boutons « déjà au panier » ---------- */
  const renderCount = (count) => {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
    });
  };

  const bumpCount = () => {
    if (reduceMotion) return;
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    });
  };

  const markInCart = (variantIds) => {
    document.querySelectorAll('[data-add-to-cart-form]').forEach((form) => {
      const id = Number(form.querySelector('input[name="id"]')?.value);
      const button = form.querySelector('[data-add-to-cart]');
      if (!button) return;
      const label = button.querySelector('[data-label]');
      if (variantIds.has(id)) {
        button.dataset.inCart = 'true';
        button.classList.add('is-added');
        if (label) label.textContent = t.viewCart || 'Voir le panier';
      } else if (button.dataset.inCart === 'true') {
        delete button.dataset.inCart;
        button.classList.remove('is-added');
        if (label) label.textContent = label.dataset.default || label.textContent;
      }
    });
  };

  document.querySelectorAll('[data-add-to-cart] [data-label]').forEach((label) => {
    label.dataset.default = label.textContent;
  });

  /* ---------- Panier latéral ---------- */
  const drawer = document.querySelector('[data-drawer]');
  const panel = drawer?.querySelector('.drawer__panel');
  let lastFocus = null;

  const ebookCount = (cart) =>
    cart.items.filter((i) => (i.product_type || '').toLowerCase() === 'ebook').reduce((n, i) => n + i.quantity, 0);

  const renderDrawer = (cart) => {
    if (!drawer) return;
    const list = drawer.querySelector('[data-drawer-items]');
    const empty = drawer.querySelector('[data-drawer-empty]');
    const foot = drawer.querySelector('[data-drawer-foot]');
    const offer = drawer.querySelector('[data-drawer-offer]');
    const offerText = drawer.querySelector('[data-drawer-offer-text]');
    const offerBar = drawer.querySelector('[data-drawer-offer-bar]');
    const saving = drawer.querySelector('[data-drawer-saving]');
    const count = drawer.querySelector('[data-drawer-count]');

    count.textContent = cart.item_count > 0 ? `(${cart.item_count})` : '';
    empty.hidden = cart.item_count > 0;
    foot.hidden = cart.item_count === 0;

    list.innerHTML = cart.items
      .map((item) => {
        let img = '';
        if (item.image) {
          let src = item.image;
          if (/^(https?:)?\/\//.test(src)) {
            const url = new URL(src, window.location.origin);
            url.searchParams.set('width', '180');
            src = url.toString();
          }
          img = `<img src="${escapeHtml(src)}" alt="" width="72" height="72" loading="lazy">`;
        }
        const offers = (item.line_level_discount_allocations || [])
          .map((a) => `<p class="drawer-line__offer">${escapeHtml(a.discount_application?.title || 'Remise')} : −${money(a.amount)}</p>`)
          .join('');
        const price =
          item.original_line_price > item.final_line_price
            ? `${money(item.final_line_price)} <s class="price__compare">${money(item.original_line_price)}</s>`
            : money(item.final_line_price);
        return `<li class="drawer-line">
          <a class="drawer-line__img" href="${escapeHtml(item.url)}" tabindex="-1" aria-hidden="true">${img}</a>
          <div>
            <p class="drawer-line__title"><a href="${escapeHtml(item.url)}">${escapeHtml(item.product_title)}</a></p>
            ${item.quantity > 1 ? `<p class="book-meta">× ${item.quantity}</p>` : ''}
            ${offers}
            <button type="button" class="drawer-line__remove" data-remove="${escapeHtml(item.key)}">${escapeHtml(t.remove || 'Retirer')}<span class="visually-hidden"> « ${escapeHtml(item.product_title)} »</span></button>
          </div>
          <p class="price">${price}</p>
        </li>`;
      })
      .join('');

    const ebooks = ebookCount(cart);
    const hasFree = cart.items.some((i) => (i.line_level_discount_allocations || []).length > 0);
    offer.hidden = ebooks === 0 && !hasFree;
    offer.classList.toggle('is-done', hasFree || ebooks >= 3);
    let pct = Math.min(100, Math.round((ebooks / 3) * 100));
    if (hasFree || ebooks >= 3) {
      offerText.innerHTML = '<strong>Offre débloquée.</strong> Ton 3ᵉ ebook est offert, la remise est appliquée.';
      pct = 100;
    } else if (ebooks === 2) {
      offerText.innerHTML = `<strong>Plus qu’un ebook</strong> et il t’est offert. <a href="${root}collections/all">Choisir le 3ᵉ</a>`;
    } else {
      offerText.innerHTML = `<strong>Encore 2 ebooks</strong> et le 3ᵉ est offert. <a href="${root}collections/all">Voir le catalogue</a>`;
    }
    offerBar.style.width = `${pct}%`;

    saving.hidden = !(cart.total_discount > 0);
    saving.textContent = cart.total_discount > 0 ? `Tu économises ${money(cart.total_discount)}` : '';
    drawer.querySelector('[data-drawer-total]').textContent = money(cart.total_price);
  };

  const focusables = () =>
    [...panel.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
      (el) => !el.closest('[hidden]')
    );

  const openDrawer = (cart) => {
    if (!drawer) {
      window.location.href = t.cartUrl || `${root}cart`;
      return;
    }
    if (cart) renderDrawer(cart);
    lastFocus = document.activeElement;
    drawer.hidden = false;
    document.body.classList.add('has-drawer');
    requestAnimationFrame(() => {
      drawer.classList.add('is-open');
      panel.focus();
    });
    if (!cart) fetchCart().then(renderDrawer).catch(() => {});
  };

  const closeDrawer = () => {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('is-open');
    document.body.classList.remove('has-drawer');
    const done = () => {
      drawer.hidden = true;
      lastFocus?.focus?.();
    };
    if (reduceMotion) done();
    else panel.addEventListener('transitionend', done, { once: true });
  };

  window.BIBLIODOR_OPEN_CART = openDrawer;

  if (drawer) {
    drawer.addEventListener('click', async (event) => {
      if (event.target.closest('[data-drawer-close]')) {
        closeDrawer();
        return;
      }
      const remove = event.target.closest('[data-remove]');
      if (!remove) return;
      remove.disabled = true;
      try {
        const response = await fetch(`${root}cart/change.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ id: remove.dataset.remove, quantity: 0 }),
        });
        if (!response.ok) throw new Error();
        const cart = await response.json();
        renderDrawer(cart);
        renderCount(cart.item_count);
        markInCart(new Set(cart.items.map((i) => i.variant_id)));
        panel.focus();
      } catch (err) {
        remove.disabled = false;
        announce(t.updateError || 'La mise à jour du panier a échoué.');
      }
    });

    drawer.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    const onCartPage = document.body.classList.contains('template-cart');
    document.querySelectorAll('[data-drawer-open]').forEach((link) => {
      if (onCartPage) return;
      link.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        openDrawer();
      });
    });
  }

  /* ---------- Ajout au panier ---------- */
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

    // Un ebook ne s'achète qu'une fois : s'il est déjà au panier, on ouvre le panier.
    if (button?.dataset.inCart === 'true') {
      openDrawer();
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
      bumpCount();
      markInCart(new Set(cart.items.map((i) => i.variant_id)));
      announce(t.added || 'Ajouté au panier.');
      openDrawer(cart);
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

  /* ---------- Ajout de plusieurs livres en une fois (séries) ---------- */
  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-multi-add]');
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const error = form.querySelector('[data-form-error]');
    if (error) error.hidden = true;
    if (button) button.disabled = true;
    try {
      const response = await fetch(`${root}cart/add.js`, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.description || data.message || '');
      const cart = await fetchCart();
      renderCount(cart.item_count);
      bumpCount();
      markInCart(new Set(cart.items.map((i) => i.variant_id)));
      announce(t.added || 'Ajouté au panier.');
      openDrawer(cart);
    } catch (err) {
      const message = (err && err.message) || t.addError || "L'ajout au panier a échoué.";
      if (error) {
        error.textContent = message;
        error.hidden = false;
      }
      announce(message);
    } finally {
      if (button) button.disabled = false;
    }
  });

  /* ---------- Tri du catalogue : appliqué dès le choix ---------- */
  document.querySelectorAll('[data-autosubmit]').forEach((select) => {
    const submit = select.form?.querySelector('[data-autosubmit-button]');
    if (submit) submit.hidden = true;
    select.addEventListener('change', () => select.form.submit());
  });

  /* ---------- En-tête : ombre une fois la page défilée ---------- */
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      document.documentElement.classList.toggle('is-scrolled', window.scrollY > 8);
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Bandeau d'offres : un message à la fois ---------- */
  document.querySelectorAll('[data-rotator]').forEach((list) => {
    const items = [...list.children];
    if (items.length < 2 || reduceMotion) return;
    let index = 0;
    let paused = false;
    list.addEventListener('mouseenter', () => (paused = true));
    list.addEventListener('mouseleave', () => (paused = false));
    list.addEventListener('focusin', () => (paused = true));
    list.addEventListener('focusout', () => (paused = false));
    setInterval(() => {
      if (paused || document.hidden) return;
      items[index].setAttribute('aria-hidden', 'true');
      index = (index + 1) % items.length;
      items[index].removeAttribute('aria-hidden');
    }, 4500);
  });
})();
