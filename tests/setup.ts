// jsdom không có matchMedia/AudioContext đầy đủ; stub tối thiểu để test chạy.
if (!('matchMedia' in window)) {
  // @ts-expect-error gán stub cho môi trường test
  window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    media: '',
    onchange: null,
    dispatchEvent: () => false,
  });
}
