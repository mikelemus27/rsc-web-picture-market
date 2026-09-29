# RSC Web Picture Market - Feature Document

## Overview
A web application to showcase and sell AI-generated pictures, videos, and audio files. Users can browse a gallery, view details, add items to a cart, and complete purchases via a REST API backend.

## Requirements
- **Frontend**: Vue 3 + TypeScript + Vite, responsive gallery UI.
- **Backend**: Bun + REST API (Node.js compatible), JSON-based data storage (or SQLite for persistence).
- **Architecture**: Hexagonal (ports & adapters) with Clean Code and SOLID principles.
- **Authentication**: Optional (future), JWT-based.
- **Data Model**: Media items (pictures, videos, audio), products, shopping cart, orders.

## Architecture Diagram
```
src/
├─ domain/          # Entities & Interfaces (Pure business logic)
│   ├─ entities/    # Picture, Video, Audio, Product, CartItem, Order
│   └─ repositories/ # Repository interfaces (e.g., ProductRepository)
├─ application/     # Use Cases (Orchestrate domain)
│   ├─ gallery/     # GetGallery, GetItem
│   ├─ cart/        # AddToCart, RemoveFromCart, Checkout
│   └─ order/       # CreateOrder, PayOrder
├─ adapters/
│   ├─ vue/         # Vue components (UI)
│   └─ rest/        # REST API handlers (Bun server)
├─ main.ts          # Bootstrap app
└─ server.ts        # Bun HTTP server
```

## Domain Model (Entities)
- **Picture**: `id`, `url`, `title`, `description`, `type: 'image'`
- **Video**: `id`, `url`, `title`, `description`, `type: 'video'`
- **Audio**: `id`, `url`, `title`, `description`, `type: 'audio'`
- **Product**: `id`, `mediaId`, `price`, `stock`, `title`, `description`
- **CartItem**: `productId`, `quantity`, `product (ref)`
- **Order**: `id`, `cartItems`, `total`, `status`, `createdAt`

## Application Use Cases
- **Gallery**: Retrieve list of media items (paginated).
- **Item Detail**: Get product details by ID.
- **Cart**: Add/remove items, view cart contents.
- **Checkout**: Create order, simulate payment.

## API Endpoints (REST)
| Method | Endpoint          | Description                     |
|--------|-------------------|---------------------------------|
| GET    | /api/media        | List media items (paginated)    |
| GET    | /api/media/:id    | Get media item details          |
| POST   | /api/cart         | Add item to cart                |
| DELETE | /api/cart/:id     | Remove item from cart           |
| POST   | /api/cart/checkout| Create order & simulate payment |

## UI Components (Vue)
- **GalleryPage**: Grid of media thumbnails.
- **MediaCard**: Displays media preview, title, price, "Add to Cart".
- **CartPage**: List of cart items, quantity controls, total price.
- **CheckoutPage**: Order summary, payment form (placeholder).
- **Header**: Navigation, cart icon.

## SOLID Compliance
- **Single Responsibility**: Each file/class has one reason to change.
- **Open/Closed**: Extend behavior via interfaces, not modify core.
- **Liskov Substitution**: Subtypes adhere to parent contracts.
- **Interface Segregation**: Small, focused interfaces.
- **Dependency Inversion**: High-level use cases depend on abstractions (repositories).

## Data Persistence
- Initial implementation: In-memory store (JSON) for demo.
- Future: Replace with SQLite/PostgreSQL using Prisma/TypeORM.

## Next Steps
1. Scaffold project structure.
2. Implement domain entities and repository interfaces.
3. Build use cases.
4. Create REST API layer.
5. Develop Vue frontend.
6. Integrate and test.