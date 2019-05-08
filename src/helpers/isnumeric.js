  // From https://stackoverflow.com/questions/9716468/pure-javascript-a-function-like-jquerys-isnumeric
  export default function (n) {
    return !isNaN(parseFloat(n)) && isFinite(n)
  }