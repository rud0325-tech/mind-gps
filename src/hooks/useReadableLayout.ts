import { useEffect } from 'react';

const contentBoxes = 'button, [role="button"], .learning-body, .learning-message, .rebt-workspace, .completion-summary, .encouragement-card, .positive-card, .sound-activity__shell, .sound-activity__controls';

/** Keep the compact layout until content actually needs more space. */
export function useReadableLayout(rootId: string, textSize = 'normal') {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    // Re-evaluate the compact layout when returning from large to normal text.
    root.querySelectorAll('[data-readable-flow]').forEach(element => element.removeAttribute('data-readable-flow'));
    let frame = 0;
    let screen: HTMLElement | null = null;
    let observed: Element[] = [];

    const measure = () => {
      frame = 0;
      const next = root.querySelector<HTMLElement>('.student-screen, .sound-activity');
      if (next !== screen) {
        screen = next;
        observed = [];
        resizeObserver.disconnect();
      }
      if (!screen || screen.dataset.readableFlow === 'true') return;
      const boxes = [screen, ...screen.querySelectorAll<HTMLElement>(contentBoxes)]
        .filter(element => !element.closest('[hidden], [inert], [aria-hidden="true"], dialog'));
      if (boxes.length !== observed.length || boxes.some((box, index) => box !== observed[index])) {
        resizeObserver.disconnect();
        boxes.forEach(box => resizeObserver.observe(box));
        observed = boxes;
      }
      const overflowing = boxes.some(element => {
        if (getComputedStyle(element).position === 'fixed' || !element.clientHeight || !element.clientWidth) return false;
        return element.scrollHeight > element.clientHeight + 2 || element.scrollWidth > element.clientWidth + 2;
      });
      // Latch per screen/viewport: the expanded layout must not toggle itself off.
      if (overflowing) screen.dataset.readableFlow = 'true';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const resizeObserver = new ResizeObserver(schedule);
    const mutationObserver = new MutationObserver(schedule);
    mutationObserver.observe(root, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    const recheckViewport = () => {
      screen?.removeAttribute('data-readable-flow');
      schedule();
    };
    window.addEventListener('resize', recheckViewport);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener('resize', recheckViewport);
    };
  }, [rootId, textSize]);
}
