# SIOMS Backend Integration Guide

This project is structured to be "Backend Ready". All data fetching is abstracted into service layers, making it easy to swap mock data for real API calls.

## 1. Configuration

The API base URL is configured in `src/services/apiClient.ts`. It defaults to `process.env.NEXT_PUBLIC_API_URL`.

Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_API_URL=https://your-backend-api.com/v1
```

## 2. Service Layer Pattern

Every module has a corresponding service in `src/services/`. To connect a module to the backend:

1. Open the service file (e.g., `src/services/attendanceService.ts`).
2. Change `const USE_MOCK = true;` to `false`.
3. Ensure the endpoint paths match your backend API.

Example of a service method:
```typescript
// src/services/attendanceService.ts
export const attendanceService = {
  getAll: async (date?: string): Promise<AttendanceRecord[]> => {
    // When USE_MOCK is false, it uses the apiClient
    return apiClient.get<AttendanceRecord[]>(`/attendance${date ? `?date=${date}` : ''}`);
  },
  // ...
}
```

## 3. Authentication

The system uses JWT-based authentication. 
- The token is stored in `localStorage` as `sioms_token`.
- The `apiClient` automatically attaches the token to the `Authorization` header for every request.
- Auth state is managed globally via `AuthContext`.

## 4. Project Structure

- `src/services/`: API call definitions and data mapping.
- `src/hooks/`: Reusable logic (e.g., `useApi` for automated fetching).
- `src/context/`: Global state (Auth, Theme).
- `src/components/modules/`: UI implementation for each system module.
- `src/types/`: TypeScript interfaces matching backend models.

## 5. Deployment

Run the following to build for production:
```bash
npm run build
# or
pnpm build
```

The system is fully responsive and supports Dark/Light modes out of the box.
