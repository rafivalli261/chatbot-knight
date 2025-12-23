# Chatbot RAG
With ChromaDB and vLLM, build the machine from zero.
## How to use
People often not realized what they can do with just a simple command from ChatGPT. Here I will show you an example of what this model is capable of. You shouldn't try this at home since for some people the cost of running a GPU Pod.


### 0. Clone the repo

```bash
git clone ....
```

### 1. Create Python venv

```bash
cd backend
python -m venv .
```

### 2. Create ingest
```bash
source bin/activate # activate the venv
pip install -r requirements.txt # install requirements
cd backend
python -m app.ingest
```

### 3. Start Backend

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
### 4. Prepare the frontend
> open new terminal

```bash
cd frontend
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc # or ~/.zshrc, depending on your shell
nvm install --lts

cd frontend
npx create-next-app@latest . --ts --app
npm install
```

### 5. Run Frontend
```bash
cd frontend
npm run dev
```

## Still in Error CORS Origin or something