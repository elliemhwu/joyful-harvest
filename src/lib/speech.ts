// Text-to-speech uses voices installed on the phone, so it usually works offline.

export function speak(text: string, rate = 0.9) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = rate
  const voice = speechSynthesis.getVoices().find(v => v.lang.startsWith('en') && v.localService)
  if (voice) u.voice = voice
  speechSynthesis.speak(u)
}

export function canSpeak() {
  return 'speechSynthesis' in window
}
