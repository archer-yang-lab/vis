const frame = document.querySelector('.interactive-frame');
frame?.addEventListener('load', () => {
  const document = frame.contentDocument;
  if (!document) return;
  const resize = () => {
    const height = Math.ceil(document.body.getBoundingClientRect().height);
    if (height > 0 && Math.abs(frame.clientHeight - height) > 1) frame.style.height = `${height}px`;
  };
  new ResizeObserver(resize).observe(document.body);
  resize();
});
