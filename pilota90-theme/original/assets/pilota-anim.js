/* PILOTA90 — Animations fiches produit (vanilla JS, IntersectionObserver) */
/* 29.09 : seuil d'apparition passé de 0.12 à 0 — sur téléphone, la description longue (.ssp-det) ne pouvait jamais atteindre 12 % visibles à l'écran et restait invisible. */
(function(){
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SECT = '.ssp-sig, .ssp-ben, .ssp-det, .ssp-faq, .ssp-cta, .ssp-cmp, .ssp-rev';

  function ready(fn){ if(document.readyState !== 'loading'){ fn(); } else { document.addEventListener('DOMContentLoaded', fn); } }

  ready(function(){
    var sections = Array.prototype.slice.call(document.querySelectorAll(SECT));
    if(!sections.length){ return; }

    /* 3 — vagues entre sections */
    var waveSVG = '<svg viewBox="0 0 1200 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M0,22 C150,42 300,4 450,22 C600,40 750,2 900,22 C1050,42 1200,4 1350,22"/></svg>';
    sections.forEach(function(sec, idx){
      if(idx === 0){ return; }
      var w = document.createElement('div');
      w.className = 'ps-wave ps-wave--anim';
      w.setAttribute('aria-hidden', 'true');
      w.innerHTML = waveSVG;
      sec.parentNode.insertBefore(w, sec);
    });

    /* 1 & 7 — reveal + cascade */
    var revealEls = [];
    function tag(el, i){ if(!el){ return; } el.classList.add('ps-reveal'); if(i){ el.style.setProperty('--i', i); } revealEls.push(el); }
    sections.forEach(function(sec){
      tag(sec.querySelector('.head'), 0);
      tag(sec.querySelector('.in'), 0);
      var kids = sec.querySelectorAll('.grid > *, .list > *, .ssp-cmp__row');
      Array.prototype.forEach.call(kids, function(el, i){ tag(el, i); });
    });
    if(reduce || !('IntersectionObserver' in window)){
      revealEls.forEach(function(el){ el.classList.add('is-visible'); });
    } else {
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-visible'); io.unobserve(e.target); } });
      }, { threshold:0, rootMargin:'0px 0px -8% 0px' });
      revealEls.forEach(function(el){ io.observe(el); });
    }

    /* 2 — compteurs animés */
    function countUp(el){
      var raw = el.getAttribute('data-count');
      var target = parseFloat(raw); if(isNaN(target)){ return; }
      var dec = (raw.split('.')[1] || '').length;
      var dur = 1500, t0 = null;
      function step(ts){ if(!t0){ t0 = ts; } var p = Math.min((ts - t0) / dur, 1); var eased = 1 - Math.pow(1 - p, 3); var val = target * eased; el.textContent = dec ? val.toFixed(dec) : Math.round(val).toString(); if(p < 1){ requestAnimationFrame(step); } }
      requestAnimationFrame(step);
    }
    var counters = document.querySelectorAll('[data-count]');
    if(counters.length){
      if(reduce || !('IntersectionObserver' in window)){ Array.prototype.forEach.call(counters, countUp); }
      else {
        var cio = new IntersectionObserver(function(entries){ entries.forEach(function(e){ if(e.isIntersecting){ countUp(e.target); cio.unobserve(e.target); } }); }, { threshold:0.6 });
        Array.prototype.forEach.call(counters, function(el){ cio.observe(el); });
      }
    }

    /* 4 — tilt 3D (souris fine uniquement) */
    var fine = window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches;
    if(fine && !reduce){
      var tiltEls = document.querySelectorAll('.ssp-ben .card, [data-tilt]');
      Array.prototype.forEach.call(tiltEls, function(card){
        card.classList.add('ps-tilt');
        card.addEventListener('mousemove', function(ev){
          var r = card.getBoundingClientRect();
          var px = (ev.clientX - r.left) / r.width - 0.5;
          var py = (ev.clientY - r.top) / r.height - 0.5;
          card.style.transition = 'transform .08s ease-out';
          card.style.transform = 'perspective(1000px) rotateY(' + (px * 8).toFixed(2) + 'deg) rotateX(' + (-py * 8).toFixed(2) + 'deg)';
        });
        card.addEventListener('mouseleave', function(){ card.style.transition = 'transform .45s ease'; card.style.transform = ''; });
      });
    }

    /* 6 — particules au clic CTA */
    var ctas = document.querySelectorAll('.ps-cta');
    Array.prototype.forEach.call(ctas, function(btn){
      btn.addEventListener('click', function(ev){
        if(reduce){ return; }
        for(var i = 0; i < 4; i++){
          var p = document.createElement('span'); p.className = 'ps-particle';
          var ang = (Math.PI * 2) * (i / 4) + Math.random() * 0.6; var dist = 26 + Math.random() * 22;
          p.style.left = ev.clientX + 'px'; p.style.top = ev.clientY + 'px';
          p.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(0) + 'px');
          p.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(0) + 'px');
          document.body.appendChild(p);
          (function(node){ setTimeout(function(){ node.parentNode && node.parentNode.removeChild(node); }, 650); })(p);
        }
      });
    });
  });
})();
