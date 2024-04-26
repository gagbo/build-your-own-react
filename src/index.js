const PRIMITIVE = "TEXT_ELEMENT";

// Fiber {
//   *** dom represent the data in the tree.
//   *** it’s the actual dom node we currently want to render
//   dom?: HTMLElement,
//   *** All other props are "pointers" to traverse the tree
//   *** We don’t need to maintain a "visited" list, because we know a node has
//   *** - at most 1 parent
//   *** - at most 1 next sibling
//   *** - and we only traverse DFS
//   props: {
//     children: HTMLElement[],
//   }
//   firstChild?: Fiber,
//   parent?: Fiber,
//   nextSibling?: Fiber,
// }
let nextUnitOfWork = null;
// The shadow DOM?
let wipRoot = null;

// Swap the Shadow DOM and the real DOM
function commitRoot() {
  commitWork(wipRoot.firstChild);
  wipRoot = null;
}

function commitWork(fiber) {
  // console.log("Fiber", fiber)
  if (!fiber) {
    return;
  }

  const domParent = fiber.parent.dom;
  if (domParent) {
    domParent.appendChild(fiber.dom);
  }
  commitWork(fiber.firstChild);
  commitWork(fiber.nextSibling);

}

function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performAndPlanUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }


  window.requestIdleCallback(workLoop)
}

// https://developer.mozilla.org/fr/docs/Web/API/Window/requestIdleCallback
//
// React now uses its own scheduler package but used to use this to not freeze the
// main thread
window.requestIdleCallback(workLoop)

function performAndPlanUnitOfWork(fiber) {
  // Add the `nextUnitOfWork` to the DOM
  // console.log("fiber.dom", fiber.dom, "!fiber.dom", !fiber.dom);
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // Create fibers for the `nextUnitOfWork` children
  const elements = fiber.props.children;
  let index = 0;
  let prevSibling = null;

  while (index < elements.length) {
    const element = elements[index];

    const childFiber = {
      type: element.type,
      props: element.props,
      parent: fiber,
      dom: null,
    }

    if (index === 0) {
      fiber.firstChild = childFiber;
    } else {
      prevSibling.nextSibling = childFiber;
    }

    prevSibling = childFiber;
    index++;
  }

  // Select the next unit of work and return it
  // We are going to traverse the DOM Depth First
  if (fiber.firstChild) {
    return fiber.firstChild;
  }

  // Otherwise, search for the next sibling, or the next sibling of the parent.
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.nextSibling) {
      return nextFiber.nextSibling;
    }

    nextFiber = nextFiber.parent;
  }

  return nextFiber;
}

function createDom(fiber) {
  // We want to detect primitive types to only make a Text node
  const dom =
        fiber.type === PRIMITIVE
        ? document.createTextNode("")
        : document.createElement(fiber.type);

  // Everything but children should be set as prop of the fiber element
  const isProperty = key => key !== "children"
  Object.keys(fiber.props)
        .filter(isProperty)
        .forEach(name => {
          dom[name] = fiber.props[name]
        })

  // console.log("Created DOM", dom);
  return dom;
}

function render(element, container) {
  // Create the root unit of work
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
  };

  nextUnitOfWork = wipRoot;

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
    <h2>Things we can do</h2>
    <p />
    <ul>
      <li>switch Dark/Light theme</li>
      <li>render elements</li>
    </ul>
    <h2>Things we (re)learnt</h2>
    <ul>
      <li>Importing external sources to CSS</li>
      <li>Using CSS variables</li>
      <li>Attaching functions to html scope</li>
      <li><pre>requestIdleCallback</pre> to leave main thread alone</li>
      <li>Babel is still everywhere (annotations to transform JSX)</li>
    </ul>
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
