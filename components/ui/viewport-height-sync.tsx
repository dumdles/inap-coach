'use client'

import { useEffect } from 'react'

// iOS Safari never shrinks the layout viewport when the on-screen keyboard
// opens — only `window.visualViewport` does. Mobile sheets (Dialog,
// BottomSheet) are `fixed` and sized off plain `vh` units, so once the
// keyboard is up they keep the height they'd have with no keyboard at all —
// any content near the bottom (e.g. a "no results" message that appears as
// the cadet types) ends up rendered behind the keyboard instead of on top of
// it. This mirrors the real visible height into a CSS var so sheets can size
// against it instead of a static `vh`.
export function ViewportHeightSync() {
    useEffect(() => {
        const vv = window.visualViewport
        function update() {
            const height = vv?.height ?? window.innerHeight
            document.documentElement.style.setProperty('--app-vh', `${height}px`)
        }
        update()
        vv?.addEventListener('resize', update)
        vv?.addEventListener('scroll', update)
        window.addEventListener('resize', update)
        return () => {
            vv?.removeEventListener('resize', update)
            vv?.removeEventListener('scroll', update)
            window.removeEventListener('resize', update)
        }
    }, [])

    return null
}
