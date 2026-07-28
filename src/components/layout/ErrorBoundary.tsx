import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("ErrorBoundary capturou:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-red-600 text-xs">
          <p className="font-bold mb-2">Erro na tela:</p>
          <pre className="whitespace-pre-wrap">{this.state.error.message}</pre>
          <pre className="whitespace-pre-wrap mt-2 text-gray-500">
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
