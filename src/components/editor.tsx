/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import EditorJS from "@editorjs/editorjs";
import Code from "@editorjs/code";
import Header from "@editorjs/header";
import Image from "@editorjs/image";
import LinkTool from "@editorjs/link";
import List from "@editorjs/list";
import Paragraph from "@editorjs/paragraph";
import Quote from "@editorjs/quote";
import Embed from "@editorjs/embed";
import PackageTool from "./editor/package-tool";

interface EditorProps {
  data: any;
  onChange: (content: any) => void;
  onImageFile?: (url: string, file: File) => void;
}

const Editor = ({ data, onChange, onImageFile }: EditorProps) => {
  const editorRef = useRef<EditorJS | null>(null);
  const holderRef = useRef<HTMLDivElement | null>(null);
  const blobUrlsRef = useRef<string[]>([]);
  const deferredCreateCancelledRef = useRef(false);
  const lastRenderedDataRef = useRef<string | null>(null);

  // Update editor content when data prop changes (for real-time sync)
  useEffect(() => {
    if (!editorRef.current || !data) return;
    
    const dataStr = JSON.stringify(data);
    // Skip if content hasn't actually changed
    if (lastRenderedDataRef.current === dataStr) return;

    // Update editor content programmatically
    editorRef.current.render(data).then(() => {
      lastRenderedDataRef.current = dataStr;
    }).catch((error) => {
      console.error('Failed to update editor content:', error);
    });
  }, [data]);

  useEffect(() => {
    const holderEl = holderRef.current;
    deferredCreateCancelledRef.current = false;
    if (editorRef.current || !holderEl) return;

    // Defer creation to next microtask so Strict Mode's first cleanup can set cancelled; only the final mount creates.
    queueMicrotask(() => {
      if (deferredCreateCancelledRef.current || !holderRef.current || editorRef.current) return;
      const el = holderRef.current!;
      try {
        el.replaceChildren();
        const instance = new EditorJS({
          holder: el,
          data,
          autofocus: true,
          tools: {
            header: Header,
            image: {
              class: Image,
              config: {
                uploader: {
                  uploadByFile(file: File) {
                    const url = URL.createObjectURL(file);
                    blobUrlsRef.current.push(url);
                    onImageFile?.(url, file);
                    return Promise.resolve({
                      success: 1,
                      file: { url },
                    });
                  },
                },
              },
            },
            package: PackageTool,
            list: List,
            paragraph: Paragraph,
            code: Code,
            quote: Quote,
            linkTool: {
              class: LinkTool,
              config: {
                endpoint:
                  typeof window !== "undefined"
                    ? `${window.location.origin}/api/fetch-url`
                    : "/api/fetch-url",
              },
            },
            embed: Embed,
          },
          async onChange(api) {
            const content = await api.saver.save();
            // Update last rendered data to prevent re-render loop
            lastRenderedDataRef.current = JSON.stringify(content);
            onChange(content);
          },
        });
        editorRef.current = instance;
        // Track initial data
        lastRenderedDataRef.current = JSON.stringify(data);
      } catch {
        editorRef.current = null;
      }
    });

    return () => {
      deferredCreateCancelledRef.current = true;
      const current = editorRef.current;
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrlsRef.current = [];
      if (
        current != null &&
        typeof (current as { destroy?: () => void }).destroy === "function"
      ) {
        (current as { destroy: () => void }).destroy();
      }
      editorRef.current = null;
      if (holderEl?.replaceChildren) holderEl.replaceChildren();
    };
    // Intentionally run only on mount/unmount. Initial data is captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={holderRef} id="editorjs" />;
};

export default Editor;
