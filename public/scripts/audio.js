(function () {
  let current = null;
  let announceTimer = 0;
  let suppressStoryClick = false;

  function announce(message) {
    const region = document.getElementById('audio-live');
    if (!region) return;
    region.textContent = '';
    window.clearTimeout(announceTimer);
    announceTimer = window.setTimeout(function () {
      region.textContent = message;
    }, 60);
  }

  function fallbackSpeak(word) {
    if (!window.speechSynthesis) {
      announce('發音失敗：' + word);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(word);
      utter.lang = 'en-US';
      utter.rate = 0.9;
      utter.onerror = function (event) {
        const reason = event && event.error;
        if (reason === 'canceled' || reason === 'interrupted') return;
        announce('發音失敗：' + word);
      };
      window.speechSynthesis.speak(utter);
      announce('改用瀏覽器語音：' + word);
    } catch (err) {
      announce('發音失敗：' + word);
    }
  }

  function playButton(btn) {
    const word = btn.getAttribute('data-word') || '';
    const src = btn.getAttribute('data-src') || '';
    if (current && !current.paused) {
      current.pause();
      current.currentTime = 0;
    }
    if (src) {
      const audio = new Audio(src);
      current = audio;
      audio.play().then(function () {
        announce('播放中：' + word);
      }).catch(function () {
        fallbackSpeak(word);
      });
    } else {
      fallbackSpeak(word);
    }
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function activateStoryWord(mark) {
    const word = (mark.textContent || '').trim();
    const id = 'word-' + word.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const card = document.getElementById(id);
    if (!card) return;
    card.classList.add('is-active');
    card.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    const audioBtn = card.querySelector('.audio-btn');
    if (audioBtn) playButton(audioBtn);
    setTimeout(function () { card.classList.remove('is-active'); }, 2200);
  }

  function prepareStoryWords() {
    const marks = document.querySelectorAll('.story strong');
    for (let i = 0; i < marks.length; i++) {
      const mark = marks[i];
      const word = (mark.textContent || '').trim();
      if (mark.getAttribute('tabindex') == null) mark.setAttribute('tabindex', '0');
      if (!mark.getAttribute('role')) mark.setAttribute('role', 'button');
      if (!mark.getAttribute('aria-label')) mark.setAttribute('aria-label', '播放 ' + word + ' 的發音');
    }
  }

  function isActivationKey(event) {
    return event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';
  }

  prepareStoryWords();

  document.addEventListener('click', function (event) {
    const btn = event.target.closest && event.target.closest('.audio-btn');
    if (btn) {
      playButton(btn);
      return;
    }
    const mark = event.target.closest && event.target.closest('.story strong');
    if (!mark) return;
    if (suppressStoryClick) {
      suppressStoryClick = false;
      return;
    }
    activateStoryWord(mark);
  });

  document.addEventListener('keydown', function (event) {
    if (event.repeat || !isActivationKey(event)) return;
    const mark = event.target && event.target.closest && event.target.closest('.story strong');
    if (!mark) return;
    event.preventDefault();
    suppressStoryClick = true;
    activateStoryWord(mark);
    window.setTimeout(function () { suppressStoryClick = false; }, 0);
  });
})();
