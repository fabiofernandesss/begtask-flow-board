import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, X, Upload, Clipboard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TaskImageUploadProps {
  taskId: string;
  imageUrls: (string | null)[];
  onImagesUpdate: (urls: (string | null)[]) => void;
}

const TaskImageUpload = ({ taskId, imageUrls, onImagesUpdate }: TaskImageUploadProps) => {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { toast } = useToast();

  const uploadImage = useCallback(async (file: File, index: number) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione apenas imagens.",
        variant: "destructive",
      });
      return;
    }

    // Limit file size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingIndex(index);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${taskId}/${Date.now()}_${index}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('task-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('task-images')
        .getPublicUrl(fileName);

      const newUrls = [...imageUrls];
      newUrls[index] = publicUrl;
      onImagesUpdate(newUrls);

      toast({ title: "Imagem enviada com sucesso!" });
    } catch (error: any) {
      console.error("Erro ao fazer upload:", error);
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingIndex(null);
    }
  }, [taskId, imageUrls, onImagesUpdate, toast]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImage(file, index);
    }
  }, [uploadImage]);

  const handlePaste = useCallback((e: React.ClipboardEvent, index: number) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          uploadImage(file, index);
        }
        break;
      }
    }
  }, [uploadImage]);

  const handleRemoveImage = useCallback(async (index: number) => {
    const url = imageUrls[index];
    if (url) {
      try {
        // Extract file path from URL
        const urlParts = url.split('/task-images/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('task-images').remove([filePath]);
        }
      } catch (error) {
        console.error("Erro ao remover imagem do storage:", error);
      }
    }

    const newUrls = [...imageUrls];
    newUrls[index] = null;
    onImagesUpdate(newUrls);
    toast({ title: "Imagem removida" });
  }, [imageUrls, onImagesUpdate, toast]);

  const handleDrop = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      uploadImage(file, index);
    }
  }, [uploadImage]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-10 gap-1.5">
        {Array.from({ length: 10 }, (_, index) => {
          const imageUrl = imageUrls[index];
          const isUploading = uploadingIndex === index;
          const isFocused = focusedIndex === index;

          return (
            <div
              key={index}
              className={`relative aspect-square rounded border-2 border-dashed transition-all ${
                isFocused 
                  ? 'border-primary bg-primary/5' 
                  : imageUrl 
                    ? 'border-border' 
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onDrop={(e) => handleDrop(e, index)}
              onDragOver={handleDragOver}
            >
              {imageUrl ? (
                <>
                  <img
                    src={imageUrl}
                    alt={`Imagem ${index + 1}`}
                    className="w-full h-full object-cover rounded"
                    onClick={() => window.open(imageUrl, '_blank')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full"
                    onClick={() => handleRemoveImage(index)}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </>
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-1"
                  onClick={() => fileInputRefs.current[index]?.click()}
                  onPaste={(e) => handlePaste(e, index)}
                  onFocus={() => setFocusedIndex(index)}
                  onBlur={() => setFocusedIndex(null)}
                  tabIndex={0}
                >
                  {isUploading ? (
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <ImagePlus className="h-4 w-4" />
                      <span className="text-[8px]">{index + 1}</span>
                    </div>
                  )}
                  <Input
                    ref={(el) => fileInputRefs.current[index] = el}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, index)}
                    onPaste={(e) => handlePaste(e, index)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <p className="text-[10px] text-muted-foreground text-center">
        Clique, Ctrl+V ou arraste imagens
      </p>
    </div>
  );
};

export default TaskImageUpload;
