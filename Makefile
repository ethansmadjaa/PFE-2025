.PHONY: front back all stop clean

# Run frontend (Next.js dev server)
front:
	cd frontend && npm run dev

# Run backend (FastAPI with Docker Compose)
back:
	docker-compose up --build

back-local:
	uv run main.py

# Run both frontend and backend
all:
	@echo "Starting backend in background..."
	make back-local
	@echo "Starting frontend..."
	cd frontend && npm run dev

# Stop all services
stop:
	docker-compose down

# Clean up Docker volumes and containers
clean:
	docker-compose down -v --rmi local
