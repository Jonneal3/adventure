/**
 * jscodeshift transform to remove all console.* calls.
 * - Removes ExpressionStatements like: console.log(...);
 * - If used in an expression context, replaces the call with void 0 to preserve syntax.
 */

module.exports = function removeConsoleCalls(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'console' },
      },
    })
    .forEach((path) => {
      const parent = path.parent;
      if (parent.value && parent.value.type === 'ExpressionStatement') {
        j(parent).remove();
      } else {
        // Replace with a no-op expression to keep surrounding syntax valid
        j(path).replaceWith(j.unaryExpression('void', j.literal(0)));
      }
    });

  return root.toSource({ quote: 'single' });
};


