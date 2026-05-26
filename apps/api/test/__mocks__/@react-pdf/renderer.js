'use strict';

const React = require('react');

const noop = () => {};
const createElement = (type, props, ...children) =>
  React.createElement(type, props, ...children);

module.exports = {
  Document: ({ children }) => children,
  Page: ({ children }) => children,
  View: ({ children }) => children,
  Text: ({ children }) => children,
  StyleSheet: { create: (styles) => styles },
  renderToBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-pdf')),
  Font: { register: noop, registerEmojiSource: noop },
  Image: ({ children }) => children,
  Link: ({ children }) => children,
  Note: ({ children }) => children,
  Canvas: ({ children }) => children,
};
