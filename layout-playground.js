(() => {
  const MIN_SCALE = 0.25;
  const MAX_SCALE = 3;
  const SCALE_STEP = 0.15;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function initLayoutPlayground() {
    const playgroundRoot = document.querySelector('[data-layout-playground]');
    if (!playgroundRoot) return;

    const board = document.getElementById('layoutBoard');
    const frameLayer = document.getElementById('frameLayer');
    const placeholder = document.getElementById('boardPlaceholder');
    const statusEl = document.getElementById('layoutStatus');
    const zoomRange = document.getElementById('zoomRange');
    const zoomBadge = document.getElementById('zoomBadge');
    const selectionHint = document.getElementById('selectionHint');
    const resetBtn = document.getElementById('resetViewBtn');
    const deleteBtn = document.getElementById('deleteFrameBtn');
    const clearAllBtn = document.getElementById('clearBoardBtn');
    const bringFrontBtn = document.getElementById('bringFrontBtn');
    const sendBackBtn = document.getElementById('sendBackBtn');
    const fileInput = document.getElementById('imageFileInput');
    const zoomButtons = document.querySelectorAll('[data-zoom]');

    if (!board || !frameLayer || !placeholder) return;

    const state = {
      frames: new Map(),
      activeFrameId: null,
      counter: 0,
      zCounter: 0,
      zFloor: 0,
      drag: {
        pointerId: null,
        frameId: null,
        offset: { x: 0, y: 0 },
      },
    };

    const boardRect = () => board.getBoundingClientRect();
    const boardCenter = () => ({ x: board.clientWidth / 2, y: board.clientHeight / 2 });

    const updateStatus = (text) => {
      if (statusEl) statusEl.textContent = text;
    };

    const updatePlaceholder = () => {
      const hasContent = state.frames.size > 0;
      placeholder.hidden = hasContent;
      board.classList.toggle('has-content', hasContent);
    };

    const applyTransform = (frame) => {
      frame.el.style.transform = `translate(${frame.position.x}px, ${frame.position.y}px) scale(${frame.scale})`;
    };

    const applyZIndex = (frame) => {
      frame.el.style.zIndex = frame.z;
    };

    const centerFrame = (frame) => {
      frame.position.x = (board.clientWidth - frame.width * frame.scale) / 2;
      frame.position.y = (board.clientHeight - frame.height * frame.scale) / 2;
    };

    const getActiveFrame = () => (state.activeFrameId ? state.frames.get(state.activeFrameId) : null);

    const updateZoomUI = () => {
      const active = getActiveFrame();
      if (active && zoomRange && zoomBadge) {
        zoomRange.disabled = false;
        zoomRange.value = active.scale.toFixed(2);
        zoomBadge.textContent = `${Math.round(active.scale * 100)}%`;
        if (selectionHint) selectionHint.textContent = `選取：第 ${active.order} 張`;
      } else {
        if (zoomRange) {
          zoomRange.value = 1;
          zoomRange.disabled = true;
        }
        if (zoomBadge) zoomBadge.textContent = '--';
        if (selectionHint) selectionHint.textContent = '尚未選取圖片';
      }
    };

    const setActiveFrame = (frameId) => {
      if (frameId && !state.frames.has(frameId)) frameId = null;
      if (state.activeFrameId === frameId) {
        updateZoomUI();
        return;
      }
      state.frames.forEach((frame, id) => {
        if (id === frameId) {
          frame.el.classList.add('is-active');
        } else {
          frame.el.classList.remove('is-active');
        }
      });
      state.activeFrameId = frameId || null;
      updateZoomUI();
    };

    const setScaleForFrame = (frame, nextScale, anchorPoint) => {
      const target = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      const anchor = anchorPoint || boardCenter();
      const local = {
        x: (anchor.x - frame.position.x) / frame.scale,
        y: (anchor.y - frame.position.y) / frame.scale,
      };
      frame.scale = target;
      frame.position.x = anchor.x - local.x * frame.scale;
      frame.position.y = anchor.y - local.y * frame.scale;
      applyTransform(frame);
    };

    const addFrameFromBlob = (blob) => {
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      const frameId = `frame-${++state.counter}`;
      const order = state.counter;
      const frameEl = document.createElement('div');
      frameEl.className = 'layout-frame';
      frameEl.dataset.frameId = frameId;

      const img = document.createElement('img');
      img.alt = `截圖 ${order}`;
      img.decoding = 'async';
      img.draggable = false;
      frameEl.appendChild(img);

      img.onload = () => {
        const frame = {
          id: frameId,
          order,
          el: frameEl,
          img,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          scale: 1,
          position: { x: 0, y: 0 },
          objectUrl,
          z: ++state.zCounter,
        };
        centerFrame(frame);
        applyTransform(frame);
        applyZIndex(frame);
        frameLayer.appendChild(frameEl);
        state.frames.set(frameId, frame);
        bindFrameEvents(frameEl);
        setActiveFrame(frameId);
        updatePlaceholder();
        updateStatus(`已加入第 ${order} 張截圖，可拖曳與縮放。`);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        updateStatus('圖片載入失敗，請再試一次。');
      };

      img.src = objectUrl;
    };

    const bringActiveToFront = () => {
      const frame = getActiveFrame();
      if (!frame) {
        updateStatus('請先選取要置頂的圖片。');
        return;
      }
      frame.z = ++state.zCounter;
      applyZIndex(frame);
      updateStatus('已將選取圖片移到最上層。');
    };

    const sendActiveToBack = () => {
      const frame = getActiveFrame();
      if (!frame) {
        updateStatus('請先選取要置底的圖片。');
        return;
      }
      frame.z = --state.zFloor;
      applyZIndex(frame);
      updateStatus('已將選取圖片移到最底層。');
    };

    const removeFrame = (frameId) => {
      const frame = state.frames.get(frameId);
      if (!frame) return;
      if (frame.objectUrl) URL.revokeObjectURL(frame.objectUrl);
      frame.el.remove();
      state.frames.delete(frameId);
      if (state.activeFrameId === frameId) {
        const latest = Array.from(state.frames.keys()).pop() || null;
        setActiveFrame(latest);
      }
      updatePlaceholder();
    };

    const removeAllFrames = () => {
      state.frames.forEach((frame) => {
        if (frame.objectUrl) URL.revokeObjectURL(frame.objectUrl);
        frame.el.remove();
      });
      state.frames.clear();
      setActiveFrame(null);
      state.zCounter = 0;
      state.zFloor = 0;
      updatePlaceholder();
      updateStatus('已清除全部圖片。');
    };

    const resetActiveFrame = () => {
      const frame = getActiveFrame();
      if (!frame) {
        updateStatus('請先選取要重設的圖片。');
        return;
      }
      frame.scale = 1;
      centerFrame(frame);
      applyTransform(frame);
      updateZoomUI();
      updateStatus('選取圖片已重設。');
    };

    const deleteActiveFrame = () => {
      if (!state.activeFrameId) {
        updateStatus('沒有選取要刪除的圖片。');
        return;
      }
      removeFrame(state.activeFrameId);
      updateStatus('選取圖片已移除。');
    };

    const handleWheel = (event) => {
      const frameEl = event.target.closest ? event.target.closest('[data-frame-id]') : null;
      const targetId = frameEl?.dataset.frameId || state.activeFrameId;
      if (!targetId || !state.frames.has(targetId)) return;
      const frame = state.frames.get(targetId);
      event.preventDefault();
      if (frameEl) setActiveFrame(targetId);
      const rect = boardRect();
      const anchor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const delta = event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      setScaleForFrame(frame, frame.scale + delta, anchor);
      updateZoomUI();
      updateStatus('已滾輪縮放目前圖片。');
    };

    function handleFramePointerDown(event) {
      const frameEl = event.currentTarget;
      const frameId = frameEl.dataset.frameId;
      if (!state.frames.has(frameId)) return;
      event.preventDefault();
      setActiveFrame(frameId);
      const rect = boardRect();
      state.drag.pointerId = event.pointerId;
      state.drag.frameId = frameId;
      state.drag.offset.x = event.clientX - rect.left - state.frames.get(frameId).position.x;
      state.drag.offset.y = event.clientY - rect.top - state.frames.get(frameId).position.y;
      if (frameEl.setPointerCapture) frameEl.setPointerCapture(event.pointerId);
      frameEl.classList.add('is-dragging');
    }

    function handleFramePointerMove(event) {
      if (state.drag.pointerId !== event.pointerId) return;
      const frame = state.frames.get(state.drag.frameId);
      if (!frame) return;
      const rect = boardRect();
      frame.position.x = event.clientX - rect.left - state.drag.offset.x;
      frame.position.y = event.clientY - rect.top - state.drag.offset.y;
      applyTransform(frame);
    }

    function handleFramePointerUp(event) {
      if (state.drag.pointerId !== event.pointerId) return;
      const frameEl = event.currentTarget;
      if (frameEl.releasePointerCapture) {
        try {
          frameEl.releasePointerCapture(event.pointerId);
        } catch (err) {
          // ignore
        }
      }
      frameEl.classList.remove('is-dragging');
      state.drag.pointerId = null;
      state.drag.frameId = null;
    }

    const bindFrameEvents = (frameEl) => {
      frameEl.addEventListener('pointerdown', handleFramePointerDown);
      frameEl.addEventListener('pointermove', handleFramePointerMove);
      frameEl.addEventListener('pointerup', handleFramePointerUp);
      frameEl.addEventListener('pointercancel', handleFramePointerUp);
    };

    const handleBlob = (blob) => addFrameFromBlob(blob);

    const handlePaste = (event) => {
      if (!event.clipboardData) return;
      const item = Array.from(event.clipboardData.items || []).find((clipboardItem) =>
        clipboardItem.type && clipboardItem.type.startsWith('image/')
      );
      if (!item) return;
      const blob = item.getAsFile();
      if (!blob) return;
      event.preventDefault();
      handleBlob(blob);
    };

    const handleFileInput = (event) => {
      const [file] = event.target.files || [];
      if (!file) return;
      handleBlob(file);
      event.target.value = '';
    };

    const handleDragOver = (event) => {
      event.preventDefault();
      board.classList.add('is-dragover');
    };

    const handleDragLeave = (event) => {
      if (event.currentTarget.contains(event.relatedTarget)) return;
      board.classList.remove('is-dragover');
    };

    const handleDrop = (event) => {
      event.preventDefault();
      board.classList.remove('is-dragover');
      const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
      const file = files.find((f) => f.type && f.type.startsWith('image/'));
      if (!file) {
        updateStatus('拖曳的檔案不是圖片。');
        return;
      }
      handleBlob(file);
    };

    window.addEventListener('paste', handlePaste);
    board.addEventListener('wheel', handleWheel, { passive: false });
    board.addEventListener('dragover', handleDragOver);
    board.addEventListener('dragleave', handleDragLeave);
    board.addEventListener('drop', handleDrop);

    if (fileInput) fileInput.addEventListener('change', handleFileInput);
    if (resetBtn) resetBtn.addEventListener('click', resetActiveFrame);
    if (deleteBtn) deleteBtn.addEventListener('click', deleteActiveFrame);
    if (clearAllBtn) clearAllBtn.addEventListener('click', removeAllFrames);
    if (bringFrontBtn) bringFrontBtn.addEventListener('click', bringActiveToFront);
    if (sendBackBtn) sendBackBtn.addEventListener('click', sendActiveToBack);
    if (zoomRange) {
      zoomRange.addEventListener('input', (event) => {
        const active = getActiveFrame();
        if (!active) {
          updateStatus('請先選取圖片。');
          return;
        }
        const value = Number(event.target.value);
        if (Number.isNaN(value)) return;
        setScaleForFrame(active, value);
        updateZoomUI();
        updateStatus('已調整縮放。');
      });
      zoomRange.disabled = true;
    }

    zoomButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const active = getActiveFrame();
        if (!active) {
          updateStatus('請先選取圖片。');
          return;
        }
        const delta = btn.dataset.zoom === 'in' ? SCALE_STEP : -SCALE_STEP;
        setScaleForFrame(active, active.scale + delta);
        updateZoomUI();
        updateStatus('已調整縮放。');
      });
    });

    updatePlaceholder();
    updateZoomUI();
    updateStatus('貼上一張截圖開始排版，想要更多就一直貼。');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLayoutPlayground);
  } else {
    initLayoutPlayground();
  }
})();
