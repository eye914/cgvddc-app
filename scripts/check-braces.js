var code = require('fs').readFileSync(__dirname + '/../public/cgv-app.js', 'utf8');
var opens = 0, closes = 0;
for (var i = 0; i < code.length; i++) {
  var c = code[i];
  if (c === '{') opens++;
  if (c === '}') closes++;
}
console.log('{ 개수:', opens, '} 개수:', closes, '차이(미닫힌):', opens - closes);
