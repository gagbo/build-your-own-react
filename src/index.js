const PRIMITIVE = "TEXT_ELEMENT";

let nextUnitOfWork = null;
function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performAndPlanUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  window.requestIdleCallback(workLoop)
}

// https://developer.mozilla.org/fr/docs/Web/API/Window/requestIdleCallback
//
// React now uses its own scheduler package but used to use this to not freeze the
// main thread
window.requestIdleCallback(workLoop)

function performAndPlanUnitOfWork(nextUnitOfWork) {
  // TODO
}

function render(element, container) {
  // We want to detect primitive types to only make a Text node
  const dom =
        element.type === PRIMITIVE
        ? document.createTextNode("")
        : document.createElement(element.type);

  // Everything but children should be set as prop of the child
  const isProperty = key => key !== "children"
  Object.keys(element.props)
        .filter(isProperty)
        .forEach(name => {
          dom[name] = element.props[name]
        })

  // Recursively render all children
  element.props.children.forEach(child => render(child, dom))

  container.appendChild(dom);
}

function createElement(type, props, ...children) {
  return {
    type,
    props: {
      ...props,
      // React doesn’t wrap the primitive types in a custom `TEXT_ELEMENT`,
      // But that means here that we can use the same code to go over all elements.
      children: children.map(child =>
        typeof child === "object"
          ? child
          : createTextElement(child)
      ),
    },
  }
}

function createTextElement(text) {
  return {
    type: PRIMITIVE,
    props: {
      nodeValue: text,
      // React doesn’t store empty arrays when there is no child,
      // it is done here so that the props always have a `children` entry we can iterate through
      children: [],
    },
  }
}


const Notact = {
  createElement,
  render,
}

///////////////////////////////
// Library / Document Border //
///////////////////////////////

/* Vanilla JS version */
// const element = Notact.createElement(
//   "div",
//   { id: "foo" },
//   Notact.createElement("a", null, "bar"),
//   Notact.createElement("b")
// )

/* Babel JSX annotation version */
/** @jsx Notact.createElement */
const element = (
  <div id="foo">
    <a>bar</a>
    <b />
  </div>
)

const container = document.getElementById("App")
Notact.render(element, container)

// Theme switcher

const LIGHT_THEME = "lunaria-light";
const DARK_THEME = "lunaria-dark";
function themeToggle()
{
  var bod = document.getElementById("body");
  if(bod.className === LIGHT_THEME){
    bod.className = DARK_THEME;
  } else {
    bod.className = LIGHT_THEME;
  }

  var but = document.getElementById("theme-switcher");
  if(bod.className === LIGHT_THEME){
    but.innerHTML = "Go to Dark";
  } else {
    but.innerHTML = "Go to Light";
  }
}
window.themeToggle = themeToggle;
