/* 严格匹配 */
export const copyRightReg = () => /\n\n===\s[\s\S]+\s===$/gm
/* 松散匹配 */
export const copyRightReg1 = () => /===\s[\s\S]+\s===$/gm

export function copyRightNodeHandler(el: HTMLElement) {
  if (el.nodeName === 'P' && copyRightReg1().test(el.innerText)) {
    el.classList.add('copy-right')

    el.style.opacity = '0.1'
    el.style.fontSize = '8px'

    /* 给最后一个copyRight添加单独的类名 */
    const copyRightEls = document.querySelectorAll('.copy-right')
    if (copyRightEls.length) {
      copyRightEls.forEach((copyRightEl) => {
        copyRightEl.classList.remove('last-copy-right')
      })

      const lastCopyRightEl = copyRightEls[copyRightEls.length - 1]
      lastCopyRightEl.classList.add('last-copy-right')
    }
  }
}

export function copyRightHandler() {
  const targetElement = document.querySelector('body') as HTMLElement

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          copyRightNodeHandler(node as HTMLElement)
        })
      }
    })
  })

  const config = { childList: true, subtree: true }
  observer.observe(targetElement, config)
}

export function copyRightInit() {
  if (typeof window !== 'undefined') {
    if (document.readyState === 'interactive' || document.readyState === 'complete')
      copyRightHandler()
    else
      window.addEventListener('DOMContentLoaded', copyRightHandler)
  }
}
