const ChatbotEnhanced = (function() {
  let currentLang = localStorage.getItem('smd_chat_lang') || 'en';
  let recognition = null;
  let synthesis = window.speechSynthesis;

  const VOICE_LANGS = {
    'en': 'en-US',
    'ta': 'ta-IN',
    'hi': 'hi-IN',
    'te': 'te-IN',
    'ml': 'ml-IN',
    'kn': 'kn-IN'
  };

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = VOICE_LANGS[currentLang] || 'en-US';

    recognition.onstart = function() {
      updateVoiceButton(true);
    };

    recognition.onend = function() {
      updateVoiceButton(false);
    };

    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      const inputField = document.querySelector('#chat-panel .chat-input-row input');
      if (inputField) {
        inputField.value = transcript;
        setTimeout(() => Chatbot.handleSend(transcript), 300);
      }
    };

    return recognition;
  }

  function toggleVoiceInput() {
    if (!recognition) {
      recognition = initSpeechRecognition();
      if (!recognition) {
        alert('Voice input not supported');
        return;
      }
    }

    if (recognition.started) {
      recognition.stop();
    } else {
      recognition.lang = VOICE_LANGS[currentLang] || 'en-US';
      recognition.start();
    }
  }

  function updateVoiceButton(listening) {
    const btn = document.querySelector('.chat-voice-btn');
    if (!btn) return;

    if (listening) {
      btn.classList.add('listening');
    } else {
      btn.classList.remove('listening');
    }
  }

  function speakText(text) {
    if (synthesis.speaking) {
      synthesis.cancel();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = VOICE_LANGS[currentLang] || 'en-US';
    utterance.rate = 0.9;
    synthesis.speak(utterance);
  }

  function changeLanguage(lang) {
    currentLang = lang;
    if (recognition) recognition.lang = VOICE_LANGS[lang] || 'en-US';
  }

  function init() {
    initSpeechRecognition();
  }

  return {
    init: init,
    toggleVoiceInput: toggleVoiceInput,
    speakText: speakText,
    changeLanguage: changeLanguage
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ChatbotEnhanced.init);
} else {
  ChatbotEnhanced.init();
}
