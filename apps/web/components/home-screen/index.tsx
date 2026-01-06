'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { ArrowUp, Lock, User, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileAvatar } from '@/components/profileavatar';
import Image from 'next/image';
import { ThemeToggle } from '../theme-toggle';
import { useTheme } from 'next-themes';

// Mock project data - replace with actual data from API
interface Project {
  id: string;
  name: string;
  date: string;
  isShared?: boolean;
  isLocked?: boolean;
  thumbnail?: string;
}

const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Activity Insight Hub Example',
    date: 'Dec 12',
    isShared: false,
    isLocked: false,
  },
  {
    id: '2',
    name: 'AI chat Example',
    date: 'Dec 9',
    isShared: false,
    isLocked: true,
  },
  {
    id: '3',
    name: 'Wireframe example',
    date: 'Nov 6',
    isShared: false,
    isLocked: true,
  },
  {
    id: '4',
    name: 'Sign up example',
    date: 'Jun 25',
    isShared: false,
    isLocked: true,
  },
];

interface UploadedImage {
  id: string;
  preview: string;
  file: File;
}

export function HomeScreen() {
  const router = useRouter();
  const [designPrompt, setDesignPrompt] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const MAX_IMAGES = 5;

  const { theme } = useTheme();
  const logoSrc =
    theme === 'dark' ? '/sia-icon-dark.svg' : '/sia-icon-light.svg';

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  const handleGenerate = () => {
    if (designPrompt.trim() || uploadedImages.length > 0) {
      // TODO: Implement design generation logic with images
      console.log(
        'Generating design for:',
        designPrompt,
        'with images:',
        uploadedImages
      );
    }
  };

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remainingSlots = MAX_IMAGES - uploadedImages.length;
      const filesToAdd = acceptedFiles.slice(0, remainingSlots);

      filesToAdd.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const newImage: UploadedImage = {
            id: `${Date.now()}-${Math.random()}`,
            preview: reader.result as string,
            file: file,
          };
          setUploadedImages(prev => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      });
    },
    [uploadedImages.length]
  );

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
    },
    multiple: true,
    maxFiles: MAX_IMAGES,
    noClick: true, // We'll handle click via button
  });

  const handleRemoveImage = (imageId: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleAttachClick = () => {
    // Trigger file input click
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = e => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length > 0) {
        const remainingSlots = MAX_IMAGES - uploadedImages.length;
        const filesToAdd = files.slice(0, remainingSlots);
        onDrop(filesToAdd);
      }
    };
    input.click();
  };

  return (
    <div className="bg-background">
      {/* Header */}
      <header className="sticky max-w-[80rem] mx-auto  rounded-full m-4 top-2 z-30 bg-card border border-border">
        <div className="flex h-20 w-full justify-between items-center gap-4 px-4 sm:px-6">
          <div className="flex items-center justify-start gap-4">
            <div className="flex items-center gap-2">
              <div className="mb-1 flex h-10 w-10 items-center justify-center">
                <Image src={logoSrc} alt="Sia Logo" width={40} height={40} />
              </div>
              <span className="text-xl font-bold text-foreground">Sia</span>
            </div>
          </div>
          <div className="flex items-center justify-end gap-5">
            <ThemeToggle />
            <ProfileAvatar />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className=" px-6 py-12">
        {/* Project Generation Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <h1 className="text-3xl font-bold text-foreground mb-6 text-center">
            What should we build?
          </h1>
          <Card className=" shadow-lg border-0 bg-card">
            <CardContent className="p-2">
              <div {...getRootProps()}>
                <input {...getInputProps()} />

                {/* Image previews - row layout */}
                {uploadedImages.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {uploadedImages.map(image => (
                      <div
                        key={image.id}
                        className="relative group inline-block"
                      >
                        <div className="relative rounded-lg overflow-visible bg-muted/50 inline-block">
                          <div className="relative inline-block">
                            <img
                              src={image.preview}
                              alt="Uploaded preview"
                              className="w-32 h-32 object-cover rounded-lg"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10 bg-black hover:bg-black/80"
                              onClick={e => {
                                e.stopPropagation();
                                handleRemoveImage(image.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input field */}
                <div className="relative mb-4">
                  <Textarea
                    placeholder="Describe the project you want to build..."
                    value={designPrompt}
                    onChange={e => setDesignPrompt(e.target.value)}
                    className="min-h-[80px] max-h-[160px] text-sm resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleGenerate();
                      }
                    }}
                  />
                </div>
              </div>

              {/* Action buttons row */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 text-muted-foreground hover:text-foreground"
                  onClick={e => {
                    e.stopPropagation();
                    handleAttachClick();
                  }}
                  disabled={uploadedImages.length >= MAX_IMAGES}
                >
                  <Paperclip className="h-4 w-4" />
                  Attach
                  {uploadedImages.length > 0 && (
                    <span className="text-xs">
                      ({uploadedImages.length}/{MAX_IMAGES})
                    </span>
                  )}
                </Button>
                <Button
                  onClick={handleGenerate}
                  className="h-9 gap-2 bg-primary hover:bg-primary/90"
                  disabled={!designPrompt.trim() && uploadedImages.length === 0}
                >
                  Generate
                  <ArrowUp className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
          {/* Try this section - outside the card */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
            <span>Try this:</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-full text-xs"
              onClick={() => setDesignPrompt('AI chat app')}
            >
              AI chat app
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-full text-xs"
              onClick={() => setDesignPrompt('Sign up screen')}
            >
              Sign up screen
            </Button>
          </div>
        </div>

        {/* Recents Section */}
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Recent Projects
            </h2>
            <div className="text-sm text-muted-foreground">All</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {mockProjects.map(project => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-lg transition-shadow shadow-lg overflow-hidden"
                onClick={() => handleProjectClick(project.id)}
              >
                <CardContent className="p-0">
                  <div className="relative">
                    <div className="absolute top-3 left-3 z-10">
                      {project.isLocked ? (
                        <Lock className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <User className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="aspect-[4/3] bg-muted rounded-t-lg overflow-hidden">
                      <img
                        src="/sia-home.png"
                        alt={project.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div className="p-5 text-sm">
                    <h3 className="font-medium text-foreground mb-1 text-base">
                      {project.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {project.date}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
