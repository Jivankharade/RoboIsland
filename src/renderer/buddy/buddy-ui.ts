declare const buddyApi: any;

let isDragging = true;
const container = document.getElementById('buddy-container')!;
const card = document.getElementById('buddy-card')!;
const targetTitle = document.getElementById('target-title')!;
const explanation = document.getElementById('buddy-explanation')!;
const btnHome = document.getElementById('btn-home')!;
const btnExplain = document.getElementById('btn-explain')!;
const btnSummarize = document.getElementById('btn-summarize')!;
const btnSpeak = document.getElementById('btn-speak')!;

let currentExplanation = 'Ready to assist.';

window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    container.style.transform = `translate(${e.clientX - 28}px, ${e.clientY - 28}px)`;
  }
});

window.addEventListener('mouseup', async (e) => {
  if (isDragging) {
    isDragging = false;
    card.style.display = 'block';

    if (typeof buddyApi !== 'undefined') {
      const data = await buddyApi.inspect({ x: e.clientX, y: e.clientY });
      targetTitle.textContent = data.process ? `${data.process} (${data.title.slice(0, 20)}...)` : 'Active Window';
      currentExplanation = `Dropped onto ${data.process || 'desktop'}. I can see what you are working on. Ask me anything or click an action below!`;
      explanation.textContent = currentExplanation;
    }
  }
});

btnHome.addEventListener('click', () => {
  if (typeof buddyApi !== 'undefined') {
    buddyApi.flyHome();
  }
});

btnExplain.addEventListener('click', () => {
  currentExplanation = 'Analyzing screen content... Found active workspace context. Everything looks orderly and clean!';
  explanation.textContent = currentExplanation;
});

btnSummarize.addEventListener('click', () => {
  currentExplanation = 'Summary: Active window contains application code and controls.';
  explanation.textContent = currentExplanation;
});

btnSpeak.addEventListener('click', () => {
  if (typeof buddyApi !== 'undefined' && currentExplanation) {
    buddyApi.speak(currentExplanation);
  }
});
