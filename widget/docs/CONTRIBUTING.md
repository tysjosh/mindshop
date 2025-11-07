# Contributing to RAG Assistant Widget

Thank you for your interest in contributing to the RAG Assistant Widget!

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git
- A code editor (VS Code recommended)

### Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/rag-assistant/widget.git
   cd widget
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development mode**
   ```bash
   npm run dev
   ```
   This will watch for changes and rebuild automatically.

4. **Open the example**
   ```bash
   # Open examples/basic.html in your browser
   open examples/basic.html
   ```

## Project Structure

```
widget/
├── src/                    # Source code
│   ├── components/        # UI components
│   ├── services/          # Business logic
│   ├── styles/            # CSS styles
│   └── types/             # TypeScript types
├── examples/              # Integration examples
├── dist/                  # Build output (git-ignored)
└── tests/                 # Test files (future)
```

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Edit files in `src/`
   - Follow the existing code style
   - Add comments for complex logic

3. **Test your changes**
   - Open `examples/basic.html` in a browser
   - Test all functionality
   - Check console for errors

4. **Build for production**
   ```bash
   npm run build
   ```

5. **Lint your code**
   ```bash
   npm run lint
   ```

### Code Style

- **TypeScript**: Use strict mode, add types for all parameters
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Comments**: Add JSDoc comments for public methods
- **Formatting**: 2 spaces for indentation, semicolons required

Example:
```typescript
/**
 * Send a chat message to the API
 * @param query - The user's question
 * @returns Promise with the response
 */
async sendMessage(query: string): Promise<ChatResponse> {
  // Implementation
}
```

### Component Guidelines

When creating new components:

1. **Single Responsibility**: Each component should do one thing well
2. **Type Safety**: Define interfaces for all props and state
3. **Error Handling**: Always handle errors gracefully
4. **Accessibility**: Use semantic HTML and ARIA attributes
5. **Performance**: Avoid unnecessary re-renders

Example component structure:
```typescript
import { RAGConfig } from '../types';

export class MyComponent {
  private config: RAGConfig;
  private container: HTMLElement | null = null;

  constructor(config: RAGConfig) {
    this.config = config;
  }

  render(parent: HTMLElement): void {
    // Create and append elements
  }

  destroy(): void {
    // Cleanup
  }
}
```

## Testing

### Manual Testing

1. **Test in multiple browsers**
   - Chrome (latest)
   - Firefox (latest)
   - Safari (latest)
   - Edge (latest)

2. **Test responsive design**
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)

3. **Test functionality**
   - Open/close widget
   - Send messages
   - View recommendations
   - Add to cart
   - Error handling

### Automated Testing (Future)

```bash
npm test
```

## Building

### Development Build
```bash
npm run dev
```
- Includes source maps
- Not minified
- Fast rebuild

### Production Build
```bash
npm run build
```
- Minified
- Optimized
- No source maps

## Submitting Changes

### Pull Request Process

1. **Update documentation**
   - Update README.md if needed
   - Add comments to complex code
   - Update CHANGELOG.md

2. **Create pull request**
   - Clear title describing the change
   - Detailed description of what and why
   - Link to related issues

3. **Code review**
   - Address reviewer feedback
   - Make requested changes
   - Keep discussion professional

### Commit Messages

Follow conventional commits:

```
feat: add voice input support
fix: resolve message scrolling issue
docs: update integration guide
style: format code with prettier
refactor: simplify API client logic
test: add unit tests for Storage
chore: update dependencies
```

## Common Tasks

### Adding a New Component

1. Create file in `src/components/`
2. Define TypeScript interface
3. Implement component class
4. Export from component file
5. Import and use in parent component
6. Add styles to `widget.css`

### Adding a New Service

1. Create file in `src/services/`
2. Define service interface
3. Implement service class
4. Add error handling
5. Export from service file
6. Use in RAGAssistant or components

### Updating Styles

1. Edit `src/styles/widget.css`
2. Use CSS custom properties for theming
3. Follow BEM naming convention
4. Test in all browsers
5. Ensure mobile responsiveness

### Adding Configuration Options

1. Update `RAGConfig` interface in `types/index.ts`
2. Add default value in `RAGAssistant.mergeWithDefaults()`
3. Use configuration in relevant component
4. Update README.md with new option
5. Add example to `examples/`

## Debugging

### Browser DevTools

1. **Console**: Check for errors and logs
2. **Network**: Inspect API requests
3. **Elements**: Inspect DOM structure
4. **Application**: Check LocalStorage

### Common Issues

**Widget not appearing**
- Check console for errors
- Verify API key is correct
- Check if script loaded successfully

**API calls failing**
- Check network tab
- Verify API endpoint is correct
- Check CORS configuration

**Styles not applying**
- Check if CSS is loaded
- Inspect element styles
- Check for CSS conflicts

## Release Process

1. **Update version**
   ```bash
   npm version patch|minor|major
   ```

2. **Build production bundle**
   ```bash
   npm run build
   ```

3. **Test thoroughly**
   - All browsers
   - All examples
   - All features

4. **Create release**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

5. **Deploy to CDN**
   ```bash
   # Upload dist/widget.js to CDN
   ```

6. **Update documentation**
   - Changelog
   - Migration guide (if breaking changes)

## Getting Help

- **Documentation**: Check README.md and ARCHITECTURE.md
- **Issues**: Search existing GitHub issues
- **Discussions**: Join our Discord community
- **Email**: dev@rag-assistant.com

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉
