const PRIMITIVE = "TEXT_ELEMENT";

const UPDATE = "effect_tag_UPDATE";
const PLACEMENT = "effect_tag_PLACEMENT";
const DELETION = "effect_tag_DELETION";

const isEvent = key => key.startsWith("on");
const isProperty = key => key !== "children" && !isEvent(key);
const isNew = (prev, next) => key =>
  prev[key] !== next[key];
const isGone = (_prev, next) => key => !(key in next);

// Fiber {
//   *** dom represent the data in the tree.
//   *** it’s the actual dom node we currently want to render
//   dom?: HTMLElement,
//   *** type is the function for function components, because of JS magic
//   type: Type
//   *** For host components
//   props: {
//     children: HTMLElement[],
//   }
//   *** For function components
//   props: Object
//   *** All other props are "pointers" to traverse the tree
//   *** We don’t need to maintain a "visited" list, because we know a node has
//   *** - at most 1 parent
//   *** - at most 1 next sibling
//   *** - and we only traverse DFS
//   child?: Fiber,
//   parent?: Fiber,
//   nextSibling?: Fiber,
//   // What is the fiber on the other tree?
//   alternate?: Fiber,
//   // Markers for the reactivity
//   effectTag?: string,
//   // Hooks that should trigger a rerender of the fiber?
//   hooks: []
// }
let nextUnitOfWork = null;
// The shadow DOM
let wipRoot = null;
// The current DOM
let currentRoot = null;
// Since we walk the DOM from the new DOM, we need
// to store the deletions to do in an extra array
// that is used in the DOM committing function.
let deletions = null;
let wipFiber = null;
let hookIndex = null;

// Swap the Shadow DOM and the real DOM
function commitRoot() {
  deletions.forEach(commitWork);
  commitWork(wipRoot.child);
  // Swap the DOMs
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber) {
  // console.log("Fiber", fiber)
  if (!fiber) {
    return;
  }

  // If we have function components, we need
  // to walk the tree up until we find where to
  // commit the node.
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }
  const domParent = domParentFiber.dom

  if (fiber.effectTag === PLACEMENT && fiber.dom !== null) {
    domParent.appendChild(fiber.dom);
  }
  else if (fiber.effectTag === UPDATE) {
    updateDom(
      fiber.dom,
      fiber.alternate.props,
      fiber.props
    )
  }
  else if (fiber.effectTag === DELETION) {
    commitDeletion(fiber, domParent);
  }
  commitWork(fiber.child);
  commitWork(fiber.nextSibling);

}

function commitDeletion(fiber, domParent) {
  // If we have function components, we need
  // to walk the tree down until we find where to
  // delete the node.
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}


function updateDom(dom, oldProps, newProps) {
  // console.log("Updating the DOM:", dom, oldProps, newProps);
  // Remove old or changed event listeners
  // Needs to be handled differently than properties because of
  // removeEventListener
  Object.keys(oldProps)
        .filter(isEvent)
        .filter(key => !(key in newProps) || isNew(oldProps, newProps)(key))
        .forEach(name => {
          // console.log("removing old listener: ", name, " on ", dom);
          const eventType = name.toLowerCase().substring(2);
          dom.removeEventListener(eventType, oldProps[name]);
        });

  // Remove deleted props
  Object.keys(oldProps)
        .filter(isProperty)
        .filter(isGone(oldProps, newProps))
        .forEach(name => { dom[name] = "" });

  // Add new props
  Object.keys(newProps)
        .filter(isProperty)
        .filter(isNew(oldProps, newProps))
        .forEach(name => { dom[name] = newProps[name] });

  // Add new event listeners
  Object.keys(newProps)
        .filter(isEvent)
        .filter(isNew(oldProps, newProps))
        .forEach(name => {
          // console.log("adding new listener: ", name, " on ", dom);
          const eventType = name.toLowerCase().substring(2);
          dom.addEventListener(eventType, newProps[name]);
        });
}

function workLoop(deadline) {
  let shouldYield = false;
  console.log("Start workloop: ", nextUnitOfWork);
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

function updateHostComponent(fiber) {
  // Add the `nextUnitOfWork` to the DOM
  // console.log("fiber.dom", fiber.dom, "!fiber.dom", !fiber.dom);
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // Create fibers for the `nextUnitOfWork` children
  reconcileChildren(fiber, fiber.props.children);
}

function updateFunctionComponent(fiber) {
  wipFiber = fiber;
  hookIndex = 0;
  wipFiber.hooks = [];

  const children = [fiber.type(fiber.props)];
  console.log("children of fiber", fiber, children);
  reconcileChildren(fiber, children);
}

function useState(initial) {
  const oldHook = wipFiber.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex];

  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }

  const actions = oldHook ? oldHook.queue : [];
  // console.log("actions: ", actions);
  actions.forEach(action => {
    hook.state = action(hook.state);
  });

  const setState = action => {
    // console.log("Called setState");
    hook.queue.push(action);
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    };
    // This is where the rerender gets queued
    nextUnitOfWork = wipRoot;
    deletions = [];
  };

  wipFiber.hooks.push(hook);
  hookIndex++;
  return [hook.state, setState];
}

function performAndPlanUnitOfWork(fiber) {
   const isFunctionComponent =
         fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }

  // Select the next unit of work and return it
  // We are going to traverse the DOM Depth First
  if (fiber.child) {
    return fiber.child;
  }

  // Otherwise, search for the next sibling, or the next sibling of the parent.
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.nextSibling) {
      return nextFiber.nextSibling;
    }
    nextFiber = nextFiber.parent;
  }
}

function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  // Only != and not !== because oldFiber can be null or undefined...
  while (index < elements.length || oldFiber != null) {
    // What needs to be rendered next
    const element = elements[index];
    let newFiber = null;

    // Compare oldFiber to element
    const sameType =
          oldFiber && element && oldFiber.type === element.type;

    // This is where React or other use "keys" to detect e.g. if elements are just being
    // swapped around in an array
    if (sameType) {
      // Update element
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: UPDATE,
      }
    } else if (element && !sameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: PLACEMENT,
      }
    } else if (oldFiber && !sameType) {
      oldFiber.effectTag = DELETION;
      deletions.push(oldFiber);
    } else {
      console.error("weird case - oldFiber: ", oldFiber, "element: ", element, "index: ", index, "elements: ", elements);
    }

    // Advance the oldFiber sibling at the same rate as
    // the index
    if (oldFiber) {
      oldFiber = oldFiber.nextSibling;
    }

    if (index === 0) {
      wipFiber.child = newFiber;
    } else if (element) {
      prevSibling.nextSibling = newFiber;
    }

    prevSibling = newFiber;
    index++;
  }

}

function createDom(fiber) {
  // We want to detect primitive types to only make a Text node
  const dom =
        fiber.type === PRIMITIVE
        ? document.createTextNode("")
        : document.createElement(fiber.type);

  // Update the DOM according to the current props
  updateDom(dom, {}, fiber.props);

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
    alternate: currentRoot,
  };

  deletions = [];
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
  useState,
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
function App(props) {
  const [state, setState] = Notact.useState(1);
  console.log("Rerender: ", state);

  return (
  <div id="foo">
    <h2>Things we can do with {props.name}</h2>
    <ul>
      <li>switch Dark/Light theme</li>
      <li>render elements</li>
    </ul>
    <button onClick={() => setState(c => {
      /* console.log("Old state", c); */
      return c + 1;
    } )}> Count: {state}</button>
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
);
}

const element = <App name="Notact" />

const container = document.getElementById("root")
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
