// Quiz progressive enhancement. With JS off, every step renders stacked and the
// form still posts. With JS on, steps show one at a time with progress + Back.
(function () {
  const form = document.querySelector('[data-quiz]');
  if (!form) return;

  // Populate hidden fields from query params, with referrer fallback for src.
  const params = new URLSearchParams(window.location.search);
  const scenario = params.get('scenario') || '';
  const src = params.get('src') || document.referrer || '';
  const scenarioField = form.querySelector('#quiz-scenario');
  const sourceField = form.querySelector('#quiz-source');
  if (scenarioField) scenarioField.value = scenario;
  if (sourceField) sourceField.value = src;

  const steps = Array.from(form.querySelectorAll('.quiz-step'));
  const progress = form.querySelector('[data-progress]');
  if (!steps.length || !progress) return;

  const total = steps.length;
  let current = 0;

  function render() {
    steps.forEach((step, i) => {
      step.hidden = i !== current;
    });
    progress.hidden = false;
    progress.textContent = 'Step ' + (current + 1) + ' of ' + total;
  }

  function validateStep(step) {
    const fields = Array.from(step.querySelectorAll('input, textarea, select'));
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  }

  form.addEventListener('click', function (event) {
    const target = event.target;
    if (target.matches('[data-next]')) {
      if (!validateStep(steps[current])) return;
      if (current < total - 1) {
        current += 1;
        render();
      }
    } else if (target.matches('[data-back]')) {
      if (current > 0) {
        current -= 1;
        render();
      }
    }
  });

  render();
})();
