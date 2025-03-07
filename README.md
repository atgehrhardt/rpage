# Rpage - RPA Application

A simple RPA (Robotic Process Automation) application built with Svelte and TypeScript, using Playwright for web automation.

## Features

- Dark mode UI
- Create, edit, run, and manage automations
- API for programmatic access
- Headless browser automation using Playwright

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd rpage

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev
```

### Build

```bash
# Build for production
npm run build
```

### Testing

```bash
# Run all tests
npm run test

# Run specific test
npm test -- -t "test name"
```

## Docker Deployment

### Using Docker Compose (recommended)

1. Make sure Docker and Docker Compose are installed on your system
2. Clone this repository
3. Run the application:
   ```bash
   docker-compose up -d
   ```
4. Access the application at http://localhost:3000
5. The API is available at http://localhost:3001

The application uses a Docker volume named `rpage_data` to store the database and outputs, ensuring data persistence between container restarts.

To reset the database and start fresh:
```bash
docker-compose down -v
docker-compose up -d
```

### Using Docker directly

1. Build the Docker image:
   ```bash
   docker build -t rpage .
   ```
2. Create a Docker volume:
   ```bash
   docker volume create rpage_data
   ```
3. Run the container:
   ```bash
   docker run -p 3000:3000 -p 3001:3001 -v rpage_data:/app/data -e RPAGE_DATA_DIR=/app/data rpage
   ```
4. Access the application at http://localhost:3000

## API Usage

The application provides a simple API for managing automations:

```typescript
// API Examples
import { 
  getAutomations,
  getAutomationById,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  runAutomationById
} from './src/utils/api';

// Get all automations
const { success, data: automations } = await getAutomations();

// Create a new automation
const newAutomation = {
  name: 'My Automation',
  description: 'This automation does something useful',
  script: `async function run() {
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage();
    await page.goto('https://example.com');
    await page.screenshot({ path: 'example.png' });
    await browser.close();
  }`,
  status: 'idle'
};

const { success, data } = await createAutomation(newAutomation);

// Run an automation
const { success, data } = await runAutomationById('automation-id');
```

## License

This project is licensed under the ISC License.