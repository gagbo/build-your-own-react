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
    type: "TEXT_ELEMENT",
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

const container = document.getElementById("app")
ReactDOM.render(element, container)
