export function CardView({ category }: { category: string }) {
  return (
    <div className="p-8 text-center text-muted-foreground">
      复习流: {category}(待实现)
    </div>
  );
}
