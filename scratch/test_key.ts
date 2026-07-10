async function test() {
  const unit = "centimeters";
  console.log("unit starts with cm (startsWith):", unit.startsWith('cm'));
  console.log("unit starts with cm (indexOf):", unit.indexOf('cm') === 0);
  console.log("unit starts with cm (regex):", /^cm/.test(unit));
}
test();
